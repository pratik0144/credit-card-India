/*
 * Best-card ranking engine (client-side analysis for the calculator island).
 *
 * This mirrors the server-side reward math in
 * supabase/functions/_shared/scoring.ts so the two never disagree on a card's
 * value: the ₹-per-₹100 conversion, the point-valuation resolution, and the
 * category-row selection are ported verbatim. It runs on the candidate data the
 * page ships at build time, so the calculator produces a real, explained ranking
 * even before the Edge Function is wired up (the same live-or-seed resilience the
 * rest of the site uses). Given a spend category and amount, it ranks the chosen
 * cards by estimated rupee value earned on that one purchase and explains why.
 */
import type { RewardType } from './taxonomy';
import { SPEND_CATEGORY_LABELS, type SpendCategoryKey } from './taxonomy';
import { formatINR } from './format';

export interface RewardCatLite {
  category_key: SpendCategoryKey;
  multiplier: number | null;
  rate_pct: number | null;
}

export interface PointValuationLite {
  bank_id: string | null;
  reward_type: string;
  estimated_inr_per_point_typical: number | null;
}

export interface BestCardCandidate {
  id: string;
  name: string;
  bank_name: string;
  bank_id: string;
  reward_type: RewardType | null;
  base_reward_value_inr_per_100: number | null;
  annual_fee_amount: number | null;
  annual_fee_waiver_spend_amount: number | null;
  rewardCategories: RewardCatLite[];
}

export interface RankedCard {
  rank: number;
  card_id: string;
  card_name: string;
  bank_name: string;
  estimated_value_inr: number;
  effective_per100: number;
  reward_type: RewardType | null;
  /** Plain-language bullet points explaining the score and placement. */
  why: string[];
  redemption_note: string;
}

/* ---- ported from _shared/scoring.ts (keep in sync) ---- */

function normalizeRt(s: string): RewardType {
  const l = s.toLowerCase();
  if (l.includes('cash')) return 'cashback';
  if (l.includes('mile')) return 'miles';
  if (l.includes('hybrid')) return 'hybrid';
  return 'points';
}

function inrPerPoint(card: BestCardCandidate, valuations: PointValuationLite[]): number {
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

function bestRowForCategory(card: BestCardCandidate, categoryKey: SpendCategoryKey): RewardCatLite | null {
  const rows = card.rewardCategories.filter((r) => r.category_key === categoryKey);
  if (rows.length === 0) return null;
  return rows.sort((a, b) => rowRank(b) - rowRank(a))[0];
}

function categoryValuePer100(card: BestCardCandidate, categoryKey: SpendCategoryKey): number {
  const base = card.base_reward_value_inr_per_100 ?? 0;
  const row = bestRowForCategory(card, categoryKey);
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

/* ---- ranking + explanation ---- */

function redemptionNote(rt: RewardType | null): string {
  return rt === 'cashback'
    ? 'Cashback, so the value lands directly on your statement.'
    : 'Value depends on how you redeem; this assumes a typical statement-credit or voucher redemption.';
}

/**
 * Rank the given candidate cards for a single purchase, best value first.
 * Returns a ranked list with an estimated rupee value and a "why" breakdown per
 * card. `amount` is the transaction size in ₹.
 */
export function rankCardsForPurchase(
  candidates: BestCardCandidate[],
  categoryKey: SpendCategoryKey,
  amount: number,
  valuations: PointValuationLite[],
): RankedCard[] {
  const label = SPEND_CATEGORY_LABELS[categoryKey];
  const amt = Number.isFinite(amount) && amount > 0 ? amount : 0;

  const scored = candidates.map((card) => {
    const per100 = categoryValuePer100(card, categoryKey);
    const base = card.base_reward_value_inr_per_100 ?? 0;
    const row = bestRowForCategory(card, categoryKey);
    const value = Math.round((amt * per100) / 100);

    const why: string[] = [];

    // 1. Category earn rate, the primary driver.
    if (row) {
      if (card.reward_type === 'cashback' && row.rate_pct != null) {
        why.push(`Earns ${trim(row.rate_pct)}% cashback on ${label}, its accelerated category.`);
      } else if (row.multiplier != null) {
        why.push(`Earns ${trim(row.multiplier)}x rewards on ${label}, above its base rate.`);
      } else if (row.rate_pct != null) {
        why.push(`Earns a boosted ${trim(row.rate_pct)}% rate on ${label}.`);
      } else {
        why.push(`Has a dedicated ${label} reward category.`);
      }
    } else {
      why.push(`No boosted rate for ${label}; earns its base rate of ${rupeePer100(base)}.`);
    }

    // 2. Effective normalised rate.
    why.push(`Effective return here is about ${rupeePer100(per100)} spent.`);

    // 3. Fee context, a high fee doesn't change per-transaction value, but it's honest to flag.
    if (card.annual_fee_amount && card.annual_fee_amount > 0) {
      why.push(
        card.annual_fee_waiver_spend_amount
          ? `Carries a ${formatINR(card.annual_fee_amount)} annual fee, waived on ${formatINR(card.annual_fee_waiver_spend_amount)} yearly spend.`
          : `Carries a ${formatINR(card.annual_fee_amount)} annual fee to weigh against the rewards.`,
      );
    } else if (card.annual_fee_amount === 0) {
      why.push('Lifetime-free, so every rupee earned here is net gain.');
    }

    return {
      card_id: card.id,
      card_name: card.name,
      bank_name: card.bank_name,
      estimated_value_inr: value,
      effective_per100: per100,
      reward_type: card.reward_type,
      why,
      redemption_note: redemptionNote(card.reward_type),
    };
  });

  scored.sort((a, b) => b.estimated_value_inr - a.estimated_value_inr || a.card_name.localeCompare(b.card_name));

  const top = scored[0]?.estimated_value_inr ?? 0;
  return scored.map((s, i) => {
    const ranked: RankedCard = { rank: i + 1, ...s };
    // 4. Placement reason relative to the winner.
    if (i === 0) {
      ranked.why.unshift(`Best value for this purchase, earning about ${formatINR(s.estimated_value_inr)}.`);
    } else {
      const gap = top - s.estimated_value_inr;
      ranked.why.unshift(
        gap > 0
          ? `Ranks #${i + 1}, about ${formatINR(gap)} less than the top card on this purchase.`
          : `Ties the top card on estimated value for this purchase.`,
      );
    }
    return ranked;
  });
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

function rupeePer100(perHundred: number): string {
  return `₹${perHundred.toFixed(2)} per ₹100`;
}
