/*
 * recommend-cards (POST) — §9.1.
 * Hard-filters an eligible pool, scores 0–100 across 5 weighted subscores,
 * assembles top-3 + stretch pick + lifetime-free fallback, generates reasons.
 * I/O contract: RecommendInput -> RecommendResult[] (database.types.ts).
 */
import { corsHeaders, getServiceClient, handleOptions, json } from '../_shared/client.ts';
import {
  ANNUAL_INCOME_FLOOR, CIBIL_BAND_FLOOR, MONTHLY_SPEND_MIDPOINT,
  eligibilityEmploymentMatch,
  type AnnualIncomeBand, type CibilBand, type EmploymentType,
  type Goal, type MonthlySpendBand, type SpendCategoryKey,
} from '../_shared/taxonomy.ts';
import {
  categoryValuePer100, inrPerPoint,
  type CardLike, type PointValuation, type RewardCatRow,
} from '../_shared/scoring.ts';

interface RecommendInput {
  goal: Goal;
  monthly_spend_band: MonthlySpendBand;
  top_categories: SpendCategoryKey[];
  air_travel_frequency: 'never' | '1_2_year' | '3_6_year' | '7_plus_year';
  employment_type: EmploymentType;
  annual_income_band: AnnualIncomeBand;
  cibil_band: CibilBand;
  fee_preference: 'lifetime_free_only' | 'value_over_3x' | 'no_preference';
}

interface DbCard extends CardLike {
  slug: string;
  name: string;
  forex_markup_pct: number | null;
  lounge_domestic_visits_per_year: number | null;
  lounge_intl_visits_per_year: number | null;
  cibil_min: number | null;
  editorial_score_5: number | null;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let input: RecommendInput;
  try {
    input = await req.json();
  } catch {
    return json({ error: 'invalid JSON body' }, 400);
  }

  const supa = getServiceClient();

  // ---- load the data we need ----
  const [{ data: cardsRaw }, { data: elig }, { data: rewardCats }, { data: ratings }, { data: valuations }] =
    await Promise.all([
      supa.from('cards').select(
        'id,bank_id,slug,name,reward_type,base_reward_value_inr_per_100,annual_fee_amount,annual_fee_waiver_spend_amount,forex_markup_pct,lounge_domestic_visits_per_year,lounge_intl_visits_per_year,cibil_min,editorial_score_5',
      ).eq('is_active', true),
      supa.from('card_eligibility').select('card_id,employment_type,min_income_amount,min_income_period'),
      supa.from('card_reward_categories').select('card_id,category_key,multiplier,rate_pct'),
      supa.from('card_ratings').select('card_id,overall_score'),
      supa.from('point_valuations').select('bank_id,reward_type,estimated_inr_per_point_typical'),
    ]);

  const cards = (cardsRaw ?? []) as DbCard[];
  const eligByCard = groupBy(elig ?? [], (e: any) => e.card_id);
  const rewardsByCard = rewardCats ?? [];
  const ratingByCard = new Map((ratings ?? []).map((r: any) => [r.card_id, r.overall_score]));
  const pvals = (valuations ?? []) as PointValuation[];

  const incomeFloor = ANNUAL_INCOME_FLOOR[input.annual_income_band];
  const allowedEmp = eligibilityEmploymentMatch(input.employment_type);
  const cibilFloor =
    input.cibil_band === 'not_sure' || input.cibil_band === 'new_to_credit'
      ? null
      : CIBIL_BAND_FLOOR[input.cibil_band as '750_plus' | '700_749' | '650_699'];

  const annualSpend = MONTHLY_SPEND_MIDPOINT[input.monthly_spend_band] * 12;

  // ---- Step 1: hard filter ----
  const eligible = cards.filter((c) => {
    const rows = eligByCard.get(c.id) ?? [];
    // employment match: card must have an eligibility row matching allowedEmp,
    // OR no eligibility row at all (unknown => don't hard-exclude, §7.3 spirit).
    if (rows.length > 0) {
      const empOk = rows.some((r: any) => allowedEmp.includes(r.employment_type));
      if (!empOk) return false;
      // income: user's band floor must clear the min income (normalized annual).
      const incomeOk = rows.some((r: any) => {
        if (r.min_income_amount == null) return true;
        const annualMin =
          r.min_income_period === 'monthly' ? r.min_income_amount * 12 : r.min_income_amount;
        return incomeFloor >= annualMin;
      });
      if (!incomeOk) return false;
    }
    // CIBIL hard filter (only when the user gave a band).
    if (cibilFloor != null && c.cibil_min != null && c.cibil_min > cibilFloor) return false;
    return true;
  });

  // ---- Step 2: score ----
  const scored = eligible.map((c) => {
    const perPoint = inrPerPoint(c, pvals);

    // (a) category match: best ₹-value across the user's top_categories.
    let bestCatValue = 0;
    for (const key of input.top_categories) {
      const v = categoryValuePer100(c, key, rewardsByCard, perPoint);
      if (v > bestCatValue) bestCatValue = v;
    }

    // blended rate for net value: avg of general base and best matched category.
    const generalPer100 = c.base_reward_value_inr_per_100 ?? 0;
    const blendedPer100 = input.top_categories.length
      ? (generalPer100 + bestCatValue) / 2
      : generalPer100;
    const grossValue = (annualSpend * blendedPer100) / 100;
    const feeWaived =
      c.annual_fee_waiver_spend_amount != null &&
      annualSpend >= c.annual_fee_waiver_spend_amount;
    const feeTerm = feeWaived ? 0 : c.annual_fee_amount ?? 0;
    const netValue = grossValue - feeTerm;

    // (c) travel fit.
    const travelRelevant =
      input.goal === 'travel_miles' ||
      input.goal === 'lounge_access' ||
      input.air_travel_frequency !== 'never';
    const lounge =
      (c.lounge_domestic_visits_per_year ?? 0) + (c.lounge_intl_visits_per_year ?? 0);
    const forexPenalty = c.forex_markup_pct != null ? Math.max(0, 3.5 - c.forex_markup_pct) : 0;
    const travelRaw = travelRelevant ? lounge + forexPenalty * 2 : 0;

    // (d) fee preference.
    const zeroFee = (c.annual_fee_amount ?? 0) === 0;
    let feePref = 0;
    if (input.fee_preference === 'lifetime_free_only') feePref = zeroFee ? 10 : 0;
    else if (input.fee_preference === 'no_preference') feePref = 10;
    else {
      // value_over_3x: reward net value over fee — credit realistic waiver.
      feePref = zeroFee ? 10 : feeWaived ? 8 : netValue > 0 ? 6 : 3;
    }

    // (e) editorial prior + CIBIL-uncertainty down-weight.
    const overall = ratingByCard.get(c.id) as number | null | undefined;
    let editorial = overall != null ? (overall / 5) * 10 : 5;
    if (input.cibil_band === 'not_sure' && c.cibil_min != null && c.cibil_min > 750) {
      editorial *= 0.7;
    }

    return {
      card: c,
      bestCatValue,
      grossValue,
      netValue,
      feeWaived,
      travelRaw,
      travelRelevant,
      lounge,
      _raw: { catMax: bestCatValue, feePref, editorial },
    };
  });

  // Scale category_match (0–35) and net_value (0–30) relative to the pool.
  const maxCat = Math.max(1, ...scored.map((s) => s.bestCatValue));
  const netValues = scored.map((s) => s.netValue);
  const minNet = Math.min(0, ...netValues);
  const maxNet = Math.max(1, ...netValues);
  const maxTravel = Math.max(1, ...scored.map((s) => s.travelRaw));

  const results = scored.map((s) => {
    const category_match = round1((s.bestCatValue / maxCat) * 35);
    const net_value = round1(((s.netValue - minNet) / (maxNet - minNet)) * 30);
    const travel_fit = s.travelRelevant ? round1((s.travelRaw / maxTravel) * 15) : 0;
    const fee_pref = round1(s._raw.feePref);
    const editorial_prior = round1(s._raw.editorial);
    const total = Math.round(category_match + net_value + travel_fit + fee_pref + editorial_prior);

    const reasons = buildReasons(s, { category_match, net_value, travel_fit, fee_pref });
    const fee_waiver_note =
      s.card.annual_fee_amount && s.card.annual_fee_amount > 0 && s.card.annual_fee_waiver_spend_amount
        ? `Waived if you spend ₹${fmt(s.card.annual_fee_waiver_spend_amount)}+ this year`
        : null;

    return {
      card: s.card,
      total_score: total,
      subscores: { category_match, net_value, travel_fit, fee_pref, editorial_prior },
      reasons,
      estimated_annual_value_inr: Math.round(Math.max(0, s.netValue)),
      fee_waiver_note,
      editorial_score_5: s.card.editorial_score_5 ?? 0,
      zeroFee: (s.card.annual_fee_amount ?? 0) === 0,
    };
  });

  // ---- Step 3: assemble result set ----
  results.sort((a, b) => b.total_score - a.total_score);
  const top3 = results.slice(0, 3);
  const chosen = new Set(top3.map((r) => r.card.id));

  const finalList = [...top3];

  // stretch pick: highest editorial_score_5 among eligible not in top3.
  const stretch = results
    .filter((r) => !chosen.has(r.card.id))
    .sort((a, b) => b.editorial_score_5 - a.editorial_score_5)[0];
  if (stretch) {
    finalList.push(stretch);
    chosen.add(stretch.card.id);
  }

  // lifetime-free fallback if none chosen so far is zero-fee.
  if (!finalList.some((r) => r.zeroFee)) {
    const ltf = results
      .filter((r) => r.zeroFee && !chosen.has(r.card.id))
      .sort((a, b) => b.total_score - a.total_score)[0];
    if (ltf) finalList.push(ltf);
  }

  const output = finalList.map((r) => ({
    card_id: r.card.id,
    card_slug: r.card.slug,
    card_name: r.card.name,
    total_score: r.total_score,
    subscores: r.subscores,
    reasons: r.reasons,
    estimated_annual_value_inr: r.estimated_annual_value_inr,
    fee_waiver_note: r.fee_waiver_note,
  }));

  // best-effort analytics log (don't block on it).
  supa.from('recommendation_sessions').insert({ answers: input, results: output }).then(
    () => {},
    () => {},
  );

  return json(output);
});

// ---- helpers ----
function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const item of arr) {
    const k = key(item);
    (m.get(k) ?? m.set(k, []).get(k)!).push(item);
  }
  return m;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

function buildReasons(
  s: { bestCatValue: number; grossValue: number; card: DbCard; feeWaived: boolean; lounge: number },
  sub: { category_match: number; net_value: number; travel_fit: number; fee_pref: number },
): string[] {
  const reasons: string[] = [];
  const parts = [
    { k: 'category_match', v: sub.category_match },
    { k: 'net_value', v: sub.net_value },
    { k: 'travel_fit', v: sub.travel_fit },
    { k: 'fee_pref', v: sub.fee_pref },
  ].sort((a, b) => b.v - a.v);

  for (const p of parts) {
    if (reasons.length >= 3) break;
    if (p.v <= 0) continue;
    if (p.k === 'category_match' && s.bestCatValue > 0) {
      reasons.push(
        `Strong match on your top spend categories, worth an estimated ₹${fmt(s.grossValue)}/year at your spend level`,
      );
    } else if (p.k === 'net_value') {
      reasons.push(
        `Good net value after fees — an estimated ₹${fmt(Math.max(0, s.grossValue - (s.feeWaived ? 0 : s.card.annual_fee_amount ?? 0)))}/year`,
      );
    } else if (p.k === 'travel_fit' && s.lounge > 0) {
      reasons.push(`${s.lounge} complimentary airport lounge visits a year for your travel`);
    } else if (p.k === 'fee_pref') {
      if ((s.card.annual_fee_amount ?? 0) === 0) reasons.push('No joining or annual fee');
      else if (s.feeWaived || s.card.annual_fee_waiver_spend_amount)
        reasons.push(
          `₹${fmt(s.card.annual_fee_amount ?? 0)} fee is realistically waived at your spend level`,
        );
    }
  }
  if (reasons.length === 0) reasons.push('Solid all-round fit for your profile');
  return reasons.slice(0, 3);
}
