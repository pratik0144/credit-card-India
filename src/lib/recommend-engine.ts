/*
 * Recommendation engine (client-side, for the RecommendWizard island).
 *
 * This is the site's core "which card is right for you?" engine. It mirrors the
 * server-side reward math in supabase/functions/_shared/scoring.ts (the
 * ₹-per-₹100 conversion and point-valuation resolution are ported verbatim, so
 * the two never disagree) and extends it with the things the old pass ignored:
 *   - real per-category spend allocation (not a band midpoint),
 *   - reward caps (cap_amount / cap_period),
 *   - welcome + milestone bonuses,
 *   - joining/annual fees with spend-based waiver,
 *   - full hard eligibility (age, income, CIBIL, employment),
 *   - lounge + forex value for travellers.
 * It runs on candidate data shipped at build time (getRecommendCandidates), so it
 * produces a real, explained ranking even without the Edge Function — the same
 * live-or-seed resilience the rest of the site uses.
 *
 * Every rupee figure is derived from structured card fields; nothing is invented.
 * KEEP IN SYNC with _shared/scoring.ts if the shared math changes.
 */
import type { RewardType, SpendCategoryKey, CibilBand, EmploymentType } from './taxonomy';
import { SPEND_CATEGORY_LABELS, CIBIL_BAND_FLOOR } from './taxonomy';
import { formatINR } from './format';

/* ------------------------------------------------------------- inputs ----- */

export interface RewardCatLite {
  category_key: SpendCategoryKey;
  multiplier: number | null;
  rate_pct: number | null;
  cap_amount: number | null;
  cap_period: 'monthly' | 'billing_cycle' | 'yearly' | null;
}

export interface EligibilityLite {
  employment_type: 'salaried' | 'self_employed' | 'student' | 'any';
  min_income_amount: number | null;
  min_income_period: 'monthly' | 'annual' | null;
}

export interface BonusLite {
  bonus_type: 'welcome' | 'milestone' | 'anniversary' | 'other';
  threshold_spend_amount: number | null;
  estimated_value_inr: number | null;
}

export interface PointValuationLite {
  bank_id: string | null;
  reward_type: string;
  estimated_inr_per_point_typical: number | null;
}

export interface RecommendCandidate {
  id: string;
  slug: string;
  name: string;
  bank_name: string;
  bank_slug: string;
  bank_id: string;
  reward_type: RewardType | null;
  base_reward_value_inr_per_100: number | null;
  joining_fee_amount: number | null;
  annual_fee_amount: number | null;
  annual_fee_waiver_spend_amount: number | null;
  forex_markup_pct: number | null;
  lounge_domestic_visits_per_year: number | null;
  lounge_intl_visits_per_year: number | null;
  age_min: number | null;
  age_max: number | null;
  cibil_min: number | null;
  editorial_score_5: number | null;
  rewardCategories: RewardCatLite[];
  eligibility: EligibilityLite[];
  bonuses: BonusLite[];
}

export type FeeAppetite = 'lifetime_free_only' | 'value_over_fee' | 'no_preference';

/** Everything the wizard collects. Amounts are rupees; spends are per month. */
export interface RecommendAnswers {
  age: number;
  employment_type: EmploymentType;
  annual_income_inr: number;
  cibil_band: CibilBand;
  goal: string;
  monthly_spend_inr: number;
  /** Monthly ₹ spend for the categories the user picked. */
  category_spend: Partial<Record<SpendCategoryKey, number>>;
  flights_per_year: number;          // 0 if they don't fly
  travel_international: boolean;
  fee_appetite: FeeAppetite;
  new_to_credit: boolean;
}

/* ------------------------------------------------------------- outputs ---- */

export interface RankedRecommendation {
  rank: number;
  card_id: string;
  card_slug: string;
  card_name: string;
  bank_name: string;
  review_path: string;
  /** Steady-state (year 2+) estimated net value on this user's spend. */
  estimated_annual_value_inr: number;
  /** First-year value including welcome bonus, minus joining fee. */
  first_year_value_inr: number;
  score: number;                     // 0-100 display score
  reasons: string[];
  fee_note: string | null;
  is_estimate: boolean;
}

/* --------------------------------------- ported value math (scoring.ts) --- */

function normalizeRt(s: string): RewardType {
  const l = s.toLowerCase();
  if (l.includes('cash')) return 'cashback';
  if (l.includes('mile')) return 'miles';
  if (l.includes('hybrid')) return 'hybrid';
  return 'points';
}

function inrPerPoint(card: RecommendCandidate, valuations: PointValuationLite[]): number {
  if (card.reward_type === 'cashback') return 1.0;
  const rt = card.reward_type ?? 'points';
  const bankMatch = valuations.find((v) => v.bank_id === card.bank_id && normalizeRt(v.reward_type) === rt);
  if (bankMatch?.estimated_inr_per_point_typical != null) return bankMatch.estimated_inr_per_point_typical;
  const anyBank = valuations.find((v) => v.bank_id === card.bank_id);
  if (anyBank?.estimated_inr_per_point_typical != null) return anyBank.estimated_inr_per_point_typical;
  const generic = valuations.find((v) => v.bank_id === null && normalizeRt(v.reward_type) === rt);
  if (generic?.estimated_inr_per_point_typical != null) return generic.estimated_inr_per_point_typical;
  return rt === 'miles' ? 0.75 : 0.25;
}

function rowRank(r: RewardCatLite): number {
  return (r.rate_pct ?? 0) + (r.multiplier ?? 0);
}

function bestRowForCategory(card: RecommendCandidate, key: SpendCategoryKey): RewardCatLite | null {
  const rows = card.rewardCategories.filter((r) => r.category_key === key);
  if (rows.length === 0) return null;
  return rows.sort((a, b) => rowRank(b) - rowRank(a))[0];
}

/** ₹ value returned per ₹100 spent in a category (mirrors categoryValuePer100). */
function per100ForRow(card: RecommendCandidate, row: RewardCatLite | null): number {
  const base = card.base_reward_value_inr_per_100 ?? 0;
  if (!row) return base;
  if (card.reward_type === 'cashback') {
    if (row.rate_pct != null) return row.rate_pct;
    if (row.multiplier != null && base > 0) return row.multiplier * base;
    return base;
  }
  if (row.rate_pct != null) return row.rate_pct;
  if (row.multiplier != null && base > 0) return row.multiplier * base;
  return base;
}

/** Annualise a category reward cap (in ₹ of reward) from its period. */
function annualCap(row: RewardCatLite): number | null {
  if (row.cap_amount == null) return null;
  switch (row.cap_period) {
    case 'monthly':
    case 'billing_cycle':
      return row.cap_amount * 12;
    case 'yearly':
      return row.cap_amount;
    default:
      return row.cap_amount; // unknown period → treat as annual (conservative)
  }
}

/* ----------------------------------------------------- lounge / travel ---- */

const LOUNGE_VALUE_DOMESTIC = 1000; // est. ₹ value per complimentary domestic visit
const LOUNGE_VALUE_INTL = 2500;     // est. ₹ value per international visit
const BASELINE_FOREX_PCT = 3.5;     // typical markup we compare against

/* --------------------------------------------------------- eligibility ---- */

function cibilFloorFor(band: CibilBand): number | null {
  if (band === 'not_sure') return null;
  if (band === 'new_to_credit') return 0;
  return CIBIL_BAND_FLOOR[band];
}

interface EligibilityCheck { ok: boolean; reason: string | null }

function checkEligibility(card: RecommendCandidate, a: RecommendAnswers): EligibilityCheck {
  // Age.
  if (card.age_min != null && a.age > 0 && a.age < card.age_min) {
    return { ok: false, reason: `needs age ${card.age_min}+` };
  }
  if (card.age_max != null && a.age > 0 && a.age > card.age_max) {
    return { ok: false, reason: `age limit is ${card.age_max}` };
  }
  // Employment + income (only when the card declares eligibility rows).
  const empMap: Record<EmploymentType, EligibilityLite['employment_type'][]> = {
    salaried: ['salaried', 'any'],
    self_employed: ['self_employed', 'any'],
    student: ['student', 'any'],
    not_employed: ['any'],
  };
  const allowedEmp = empMap[a.employment_type];
  if (card.eligibility.length > 0) {
    const empRows = card.eligibility.filter((r) => allowedEmp.includes(r.employment_type));
    if (empRows.length === 0) return { ok: false, reason: 'employment profile not eligible' };
    const incomeOk = empRows.some((r) => {
      if (r.min_income_amount == null) return true;
      const annualMin = r.min_income_period === 'monthly' ? r.min_income_amount * 12 : r.min_income_amount;
      return a.annual_income_inr >= annualMin;
    });
    if (!incomeOk) {
      const min = Math.min(...empRows.filter((r) => r.min_income_amount != null).map((r) =>
        r.min_income_period === 'monthly' ? (r.min_income_amount as number) * 12 : (r.min_income_amount as number)));
      return { ok: false, reason: `needs income ${formatINR(min)}/yr` };
    }
  }
  // CIBIL.
  const floor = cibilFloorFor(a.cibil_band);
  if (floor != null && card.cibil_min != null && card.cibil_min > floor) {
    return { ok: false, reason: `typically needs CIBIL ${card.cibil_min}+` };
  }
  // New-to-credit users can't realistically clear premium (750+) cards.
  if (a.new_to_credit && card.cibil_min != null && card.cibil_min >= 750) {
    return { ok: false, reason: 'usually needs an established credit history' };
  }
  return { ok: true, reason: null };
}

/* ------------------------------------------------------------- scoring ---- */

interface Scored {
  card: RecommendCandidate;
  rewardAnnual: number;
  steadyNet: number;
  firstYearNet: number;
  feeCharged: number;
  feeWaived: boolean;
  welcome: number;
  travelValue: number;
  topContribs: { label: string; value: number; capped: boolean }[];
  milestoneValue: number;
}

function scoreCard(card: RecommendCandidate, a: RecommendAnswers, valuations: PointValuationLite[]): Scored {
  const monthlyTotal = Math.max(0, a.monthly_spend_inr);
  const categorySpend = a.category_spend ?? {};
  const namedMonthly = (Object.values(categorySpend) as number[]).reduce((s, v) => s + (v > 0 ? v : 0), 0);
  const generalMonthly = Math.max(0, monthlyTotal - namedMonthly);
  const base = card.base_reward_value_inr_per_100 ?? 0;

  const contribs: { label: string; value: number; capped: boolean }[] = [];
  let rewardAnnual = 0;

  // Per-category rewards (with caps).
  for (const key of Object.keys(categorySpend) as SpendCategoryKey[]) {
    const monthly = categorySpend[key] ?? 0;
    if (monthly <= 0) continue;
    const row = bestRowForCategory(card, key);
    const per100 = per100ForRow(card, row);
    let value = (monthly * 12 * per100) / 100;
    let capped = false;
    if (row) {
      const cap = annualCap(row);
      if (cap != null && value > cap) { value = cap; capped = true; }
    }
    rewardAnnual += value;
    contribs.push({ label: SPEND_CATEGORY_LABELS[key], value, capped });
  }

  // Remaining spend at the general/base rate.
  if (generalMonthly > 0 && base > 0) {
    const value = (generalMonthly * 12 * base) / 100;
    rewardAnnual += value;
    contribs.push({ label: 'Other spends', value, capped: false });
  }

  const annualSpend = monthlyTotal * 12;

  // Welcome + achievable milestone bonuses.
  const welcome = card.bonuses
    .filter((b) => b.bonus_type === 'welcome')
    .reduce((s, b) => s + (b.estimated_value_inr ?? 0), 0);
  const milestoneValue = card.bonuses
    .filter((b) => b.bonus_type === 'milestone' && (b.threshold_spend_amount == null || annualSpend >= b.threshold_spend_amount))
    .reduce((s, b) => s + (b.estimated_value_inr ?? 0), 0);

  // Fees.
  const feeWaived = card.annual_fee_waiver_spend_amount != null && annualSpend >= card.annual_fee_waiver_spend_amount;
  const feeCharged = feeWaived ? 0 : (card.annual_fee_amount ?? 0);
  const joining = card.joining_fee_amount ?? 0;

  // Lounge + forex value for travellers.
  let travelValue = 0;
  if (a.flights_per_year > 0) {
    const domVisits = card.lounge_domestic_visits_per_year ?? 0;
    const intlVisits = card.lounge_intl_visits_per_year ?? 0;
    // Cap credited visits at ~2 per flight so it never dominates unrealistically.
    const usableDom = Math.min(domVisits, a.flights_per_year * 2);
    const usableIntl = Math.min(intlVisits, a.flights_per_year);
    travelValue += usableDom * LOUNGE_VALUE_DOMESTIC + usableIntl * LOUNGE_VALUE_INTL;
    if (a.travel_international && card.forex_markup_pct != null) {
      const saving = Math.max(0, BASELINE_FOREX_PCT - card.forex_markup_pct);
      // Assume ~15% of annual spend is international when they travel abroad.
      travelValue += (annualSpend * 0.15 * saving) / 100;
    }
  }

  const steadyNet = rewardAnnual + milestoneValue + travelValue - feeCharged;
  const firstYearNet = steadyNet + welcome - joining;

  return {
    card, rewardAnnual, steadyNet, firstYearNet, feeCharged, feeWaived,
    welcome, travelValue, milestoneValue,
    topContribs: contribs.sort((x, y) => y.value - x.value),
  };
}

/* -------------------------------------------------------- explanations ---- */

function buildReasons(s: Scored, a: RecommendAnswers): string[] {
  const c = s.card;
  const out: string[] = [];

  const top = s.topContribs.filter((t) => t.value > 0).slice(0, 2);
  if (top.length > 0) {
    out.push(
      `Earns about ${formatINR(Math.round(s.rewardAnnual))}/yr on your spending, led by ${top
        .map((t) => `${t.label} (${formatINR(Math.round(t.value))}${t.capped ? ', at its reward cap' : ''})`)
        .join(' and ')}.`,
    );
  } else if (s.rewardAnnual > 0) {
    out.push(`Earns about ${formatINR(Math.round(s.rewardAnnual))}/yr on your spending.`);
  }

  if (s.welcome > 0) out.push(`Welcome benefit worth about ${formatINR(s.welcome)} in year one.`);
  if (s.milestoneValue > 0) out.push(`Your spend unlocks milestone rewards worth about ${formatINR(Math.round(s.milestoneValue))}/yr.`);

  if ((c.annual_fee_amount ?? 0) === 0) out.push('Lifetime-free — no joining or annual fee.');
  else if (s.feeWaived) out.push(`Annual fee of ${formatINR(c.annual_fee_amount ?? 0)} is waived at your spend level.`);
  else out.push(`Annual fee of ${formatINR(c.annual_fee_amount ?? 0)} is already netted out of the value above.`);

  if (s.travelValue > 0) {
    const lounges = (c.lounge_domestic_visits_per_year ?? 0) + (c.lounge_intl_visits_per_year ?? 0);
    out.push(`Travel perks add about ${formatINR(Math.round(s.travelValue))}/yr${lounges > 0 ? ` (lounge access${a.travel_international && c.forex_markup_pct != null ? ` + ${c.forex_markup_pct}% forex` : ''})` : ''}.`);
  }

  if (c.editorial_score_5 != null) out.push(`Editorial rating ${c.editorial_score_5.toFixed(1)}/5.`);

  return out;
}

/* ------------------------------------------------------------- ranking ---- */

/**
 * Rank cards for a user. Eligible cards only, sorted by a blend of estimated
 * annual value (dominant), editorial prior, and fee-preference fit. Returns the
 * top `limit` as ranked 1..N. `ineligible` is exposed for optional messaging.
 */
export function recommendCards(
  candidates: RecommendCandidate[],
  answers: RecommendAnswers,
  valuations: PointValuationLite[],
  limit = 5,
): { ranked: RankedRecommendation[]; consideredCount: number; eligibleCount: number } {
  const eligible: Scored[] = [];
  for (const card of candidates) {
    if (!checkEligibility(card, answers).ok) continue;
    eligible.push(scoreCard(card, answers, valuations));
  }

  if (eligible.length === 0) {
    return { ranked: [], consideredCount: candidates.length, eligibleCount: 0 };
  }

  // Composite score for ordering: normalise net value to 0-70, add editorial
  // (0-20) and fee-preference alignment (0-10).
  const maxNet = Math.max(1, ...eligible.map((s) => s.steadyNet));
  const minNet = Math.min(0, ...eligible.map((s) => s.steadyNet));
  const span = Math.max(1, maxNet - minNet);

  const withScore = eligible.map((s) => {
    const valueScore = ((s.steadyNet - minNet) / span) * 70;
    const editorialScore = ((s.card.editorial_score_5 ?? 3) / 5) * 20;
    const zeroFee = (s.card.annual_fee_amount ?? 0) === 0;
    let feeScore = 5;
    if (answers.fee_appetite === 'lifetime_free_only') feeScore = zeroFee ? 10 : 0;
    else if (answers.fee_appetite === 'no_preference') feeScore = 8;
    else feeScore = zeroFee ? 9 : s.feeWaived ? 8 : s.steadyNet > 0 ? 7 : 3;
    const score = Math.round(valueScore + editorialScore + feeScore);
    return { s, score };
  });

  withScore.sort((a, b) =>
    b.score - a.score ||
    b.s.steadyNet - a.s.steadyNet ||
    a.s.card.name.localeCompare(b.s.card.name),
  );

  const ranked: RankedRecommendation[] = withScore.slice(0, limit).map(({ s, score }, i) => {
    const zeroFee = (s.card.annual_fee_amount ?? 0) === 0;
    const feeNote = zeroFee
      ? 'Lifetime-free'
      : s.feeWaived
      ? `₹${Math.round(s.card.annual_fee_amount ?? 0).toLocaleString('en-IN')} fee, waived at your spend`
      : `₹${Math.round(s.card.annual_fee_amount ?? 0).toLocaleString('en-IN')} annual fee`;
    const cardSlug = s.card.bank_slug
      ? s.card.slug.replace(new RegExp(`^${s.card.bank_slug}-`), '')
      : s.card.slug;
    return {
      rank: i + 1,
      card_id: s.card.id,
      card_slug: s.card.slug,
      card_name: s.card.name,
      bank_name: s.card.bank_name,
      review_path: `/cards/${s.card.bank_slug}/${cardSlug}`,
      estimated_annual_value_inr: Math.round(s.steadyNet),
      first_year_value_inr: Math.round(s.firstYearNet),
      score: Math.max(0, Math.min(100, score)),
      reasons: buildReasons(s, answers),
      fee_note: feeNote,
      is_estimate: true,
    };
  });

  return { ranked, consideredCount: candidates.length, eligibleCount: eligible.length };
}
