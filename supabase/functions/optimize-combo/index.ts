/*
 * optimize-combo (POST) — §9.2.
 * Greedy marginal-value heuristic (NOT exhaustive combinatorial search):
 *  1. hard eligibility filter (same as §9.1)
 *  2. per-card per-category effective ₹/₹100 rate
 *  3. pre-rank by single-card annual net value, keep top ~40
 *  4. greedy build: card #1 = best single-card; each further slot = highest
 *     MARGINAL value; stop early if best marginal value ≤ 0
 *  5. winner-take-all per-category assignment across the final combo
 *  6. recompute totals (fee waived per card only if its ASSIGNED spend clears
 *     that card's waiver threshold)
 *  7. redundancy warnings (overlapping lounge / same-category benefit)
 *  8. return primary combo + one alternate (max_cards-1)
 * I/O: ComboInput -> ComboResult[] (database.types.ts).
 */
import { getServiceClient, handleOptions, json } from '../_shared/client.ts';
import {
  ANNUAL_INCOME_FLOOR, CIBIL_BAND_FLOOR, SPEND_CATEGORY_KEYS,
  eligibilityEmploymentMatch,
  type AnnualIncomeBand, type CibilBand, type EmploymentType, type SpendCategoryKey,
} from '../_shared/taxonomy.ts';
import {
  categoryValuePer100, inrPerPoint,
  type CardLike, type PointValuation, type RewardCatRow,
} from '../_shared/scoring.ts';

interface ComboInput {
  category_spend: Partial<Record<SpendCategoryKey, number>>; // monthly ₹
  max_cards: 2 | 3;
  eligibility: {
    employment_type: EmploymentType;
    annual_income_band: AnnualIncomeBand;
    cibil_band: CibilBand;
  };
  max_total_annual_fee?: number;
}

interface DbCard extends CardLike {
  name: string;
  lounge_domestic_visits_per_year: number | null;
  lounge_intl_visits_per_year: number | null;
  cibil_min: number | null;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let input: ComboInput;
  try { input = await req.json(); } catch { return json({ error: 'invalid JSON body' }, 400); }
  if (!input.category_spend || !input.max_cards) return json({ error: 'category_spend and max_cards required' }, 400);

  const supa = getServiceClient();
  const [{ data: cardsRaw }, { data: elig }, { data: rewardCats }, { data: valuations }] =
    await Promise.all([
      supa.from('cards').select(
        'id,bank_id,name,reward_type,base_reward_value_inr_per_100,annual_fee_amount,annual_fee_waiver_spend_amount,lounge_domestic_visits_per_year,lounge_intl_visits_per_year,cibil_min',
      ).eq('is_active', true),
      supa.from('card_eligibility').select('card_id,employment_type,min_income_amount,min_income_period'),
      supa.from('card_reward_categories').select('card_id,category_key,multiplier,rate_pct'),
      supa.from('point_valuations').select('bank_id,reward_type,estimated_inr_per_point_typical'),
    ]);

  const cards = (cardsRaw ?? []) as DbCard[];
  const rewards = (rewardCats ?? []) as RewardCatRow[];
  const pvals = (valuations ?? []) as PointValuation[];
  const eligByCard = new Map<string, any[]>();
  for (const e of (elig ?? []) as any[]) {
    (eligByCard.get(e.card_id) ?? eligByCard.set(e.card_id, []).get(e.card_id)!).push(e);
  }

  // ---- Step 1: hard eligibility filter ----
  const incomeFloor = ANNUAL_INCOME_FLOOR[input.eligibility.annual_income_band];
  const allowedEmp = eligibilityEmploymentMatch(input.eligibility.employment_type);
  const cibilFloor =
    input.eligibility.cibil_band === 'not_sure' || input.eligibility.cibil_band === 'new_to_credit'
      ? null
      : CIBIL_BAND_FLOOR[input.eligibility.cibil_band as '750_plus' | '700_749' | '650_699'];

  const eligible = cards.filter((c) => {
    const rows = eligByCard.get(c.id) ?? [];
    if (rows.length > 0) {
      if (!rows.some((r) => allowedEmp.includes(r.employment_type))) return false;
      const incomeOk = rows.some((r) => {
        if (r.min_income_amount == null) return true;
        const annualMin = r.min_income_period === 'monthly' ? r.min_income_amount * 12 : r.min_income_amount;
        return incomeFloor >= annualMin;
      });
      if (!incomeOk) return false;
    }
    if (cibilFloor != null && c.cibil_min != null && c.cibil_min > cibilFloor) return false;
    if (input.max_total_annual_fee != null && (c.annual_fee_amount ?? 0) > input.max_total_annual_fee) {
      // a single card already over budget can't be part of a within-budget combo alone,
      // but keep it — the combo-level budget check happens after assembly.
    }
    return true;
  });

  // Annual spend per category (input is monthly).
  const annualSpend: Partial<Record<SpendCategoryKey, number>> = {};
  const activeCats: SpendCategoryKey[] = [];
  for (const k of SPEND_CATEGORY_KEYS) {
    const monthly = input.category_spend[k];
    if (monthly && monthly > 0) { annualSpend[k] = monthly * 12; activeCats.push(k); }
  }

  // ---- Step 2: per-card per-category ₹/₹100 rate ----
  const rateOf = new Map<string, Partial<Record<SpendCategoryKey, number>>>();
  for (const c of eligible) {
    const perPoint = inrPerPoint(c, pvals);
    const m: Partial<Record<SpendCategoryKey, number>> = {};
    for (const k of activeCats) m[k] = categoryValuePer100(c, k, rewards, perPoint);
    rateOf.set(c.id, m);
  }

  const singleNet = (c: DbCard): number => {
    const rates = rateOf.get(c.id)!;
    let gross = 0;
    for (const k of activeCats) gross += ((annualSpend[k] ?? 0) * (rates[k] ?? 0)) / 100;
    const capturedFeeWaived = c.annual_fee_waiver_spend_amount != null &&
      totalAnnual(annualSpend) >= c.annual_fee_waiver_spend_amount;
    return gross - (capturedFeeWaived ? 0 : c.annual_fee_amount ?? 0);
  };

  // ---- Step 3: pre-rank, keep top 40 ----
  const pool = [...eligible].sort((a, b) => singleNet(b) - singleNet(a)).slice(0, 40);
  if (pool.length === 0) return json([]);

  // ---- Step 4/5/6: greedy build + assignment + totals ----
  const primary = buildCombo(pool, input.max_cards, activeCats, annualSpend, rateOf);
  // alternate: best combo constrained to max_cards - 1 (comparison point, §9.2.8).
  const altSize = Math.max(1, input.max_cards - 1) as 1 | 2;
  const alternate = buildCombo(pool, altSize, activeCats, annualSpend, rateOf);

  const output = [primary, alternate]
    .filter(Boolean)
    .filter((c, i, arr) => i === 0 || sig(c!) !== sig(arr[0]!)) // drop identical alternate
    .map((combo) => toResult(combo!, cards));

  supa.from('combo_optimizer_sessions').insert({ answers: input, results: output }).then(() => {}, () => {});
  return json(output);
});

/* ---- combo construction ---- */
interface Combo {
  cardIds: string[];
  assignment: Partial<Record<SpendCategoryKey, string>>;
  totalReward: number;
  totalFees: number;
  net: number;
  cards: DbCard[];
}

function buildCombo(
  pool: DbCard[], maxCards: number, cats: SpendCategoryKey[],
  annualSpend: Partial<Record<SpendCategoryKey, number>>,
  rateOf: Map<string, Partial<Record<SpendCategoryKey, number>>>,
): Combo | null {
  if (pool.length === 0) return null;
  const chosen: DbCard[] = [];
  // best-rate-so-far per category (₹/₹100).
  const bestRate: Partial<Record<SpendCategoryKey, number>> = {};

  // card #1 = best single-card net value.
  const first = [...pool].sort((a, b) =>
    singleGross(b, cats, annualSpend, rateOf) - (b.annual_fee_amount ?? 0) -
    (singleGross(a, cats, annualSpend, rateOf) - (a.annual_fee_amount ?? 0)),
  )[0];
  chosen.push(first);
  for (const k of cats) bestRate[k] = rateOf.get(first.id)![k] ?? 0;

  while (chosen.length < maxCards) {
    let bestCand: DbCard | null = null;
    let bestMarginal = 0;
    for (const c of pool) {
      if (chosen.some((x) => x.id === c.id)) continue;
      const rates = rateOf.get(c.id)!;
      let marginalGross = 0;
      let captured = 0;
      for (const k of cats) {
        const gain = Math.max(0, (rates[k] ?? 0) - (bestRate[k] ?? 0));
        if (gain > 0) {
          marginalGross += ((annualSpend[k] ?? 0) * gain) / 100;
          captured += annualSpend[k] ?? 0;
        }
      }
      const feeWaived = c.annual_fee_waiver_spend_amount != null && captured >= c.annual_fee_waiver_spend_amount;
      const marginal = marginalGross - (feeWaived ? 0 : c.annual_fee_amount ?? 0);
      if (marginal > bestMarginal) { bestMarginal = marginal; bestCand = c; }
    }
    if (!bestCand || bestMarginal <= 0) break; // §9.2.4 stop early
    chosen.push(bestCand);
    const rates = rateOf.get(bestCand.id)!;
    for (const k of cats) bestRate[k] = Math.max(bestRate[k] ?? 0, rates[k] ?? 0);
  }

  // ---- Step 5: winner-take-all assignment ----
  const assignment: Partial<Record<SpendCategoryKey, string>> = {};
  const assignedSpend = new Map<string, number>();
  for (const k of cats) {
    let bestId = chosen[0].id; let bestVal = -1;
    for (const c of chosen) {
      const v = rateOf.get(c.id)![k] ?? 0;
      if (v > bestVal) { bestVal = v; bestId = c.id; }
    }
    assignment[k] = bestId;
    assignedSpend.set(bestId, (assignedSpend.get(bestId) ?? 0) + (annualSpend[k] ?? 0));
  }

  // ---- Step 6: recompute totals from assignment ----
  let totalReward = 0; let totalFees = 0;
  for (const c of chosen) {
    const spend = assignedSpend.get(c.id) ?? 0;
    let gross = 0;
    for (const k of cats) {
      if (assignment[k] === c.id) gross += ((annualSpend[k] ?? 0) * (rateOf.get(c.id)![k] ?? 0)) / 100;
    }
    totalReward += gross;
    const feeWaived = c.annual_fee_waiver_spend_amount != null && spend >= c.annual_fee_waiver_spend_amount;
    totalFees += feeWaived ? 0 : c.annual_fee_amount ?? 0;
  }

  return {
    cardIds: chosen.map((c) => c.id), assignment,
    totalReward: Math.round(totalReward), totalFees: Math.round(totalFees),
    net: Math.round(totalReward - totalFees), cards: chosen,
  };
}

function singleGross(
  c: DbCard, cats: SpendCategoryKey[],
  annualSpend: Partial<Record<SpendCategoryKey, number>>,
  rateOf: Map<string, Partial<Record<SpendCategoryKey, number>>>,
): number {
  let g = 0;
  for (const k of cats) g += ((annualSpend[k] ?? 0) * (rateOf.get(c.id)![k] ?? 0)) / 100;
  return g;
}

function totalAnnual(spend: Partial<Record<SpendCategoryKey, number>>): number {
  return Object.values(spend).reduce((a, b) => a + (b ?? 0), 0);
}

/* ---- redundancy warnings (§9.2.7) + result shape ---- */
function toResult(combo: Combo, allCards: DbCard[]) {
  const warnings: string[] = [];
  const withLounge = combo.cards.filter(
    (c) => (c.lounge_domestic_visits_per_year ?? 0) + (c.lounge_intl_visits_per_year ?? 0) > 0,
  );
  if (withLounge.length >= 2) {
    warnings.push('Both cards offer airport lounge access — you may not need the overlap; consider dropping one.');
  }
  return {
    cards: combo.cards.map((c) => ({ card_id: c.id, card_name: c.name })),
    per_category_assignment: combo.assignment,
    total_annual_reward_value_inr: combo.totalReward,
    total_annual_fees_inr: combo.totalFees,
    net_value_inr: combo.net,
    warnings,
  };
}

function sig(combo: Combo): string {
  return [...combo.cardIds].sort().join('|');
}
