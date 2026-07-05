/*
 * Shared reward-value math used by recommend-cards, optimize-combo, and
 * best-card-for-purchase. Keeps the ₹-per-₹100 conversion consistent across
 * all three functions so they never disagree on a card's value.
 */
import type { SpendCategoryKey, RewardType } from './taxonomy.ts';

export interface RewardCatRow {
  card_id: string;
  category_key: SpendCategoryKey;
  multiplier: number | null;
  rate_pct: number | null;
}

export interface PointValuation {
  bank_id: string | null;
  reward_type: string;
  estimated_inr_per_point_typical: number | null;
}

export interface CardLike {
  id: string;
  bank_id: string;
  reward_type: RewardType | null;
  base_reward_value_inr_per_100: number | null;
  annual_fee_amount: number | null;
  annual_fee_waiver_spend_amount: number | null;
}

/**
 * Resolve the typical ₹-per-point for a card: prefer a bank-specific valuation
 * matching the card's reward_type, then a generic (bank_id null) fallback of
 * the same type, then a safe default. Cashback = 1.0 by definition.
 */
export function inrPerPoint(
  card: CardLike,
  valuations: PointValuation[],
): number {
  if (card.reward_type === 'cashback') return 1.0;
  const rt = card.reward_type ?? 'points';
  const bankMatch = valuations.find(
    (v) => v.bank_id === card.bank_id && normalizeRt(v.reward_type) === rt,
  );
  if (bankMatch?.estimated_inr_per_point_typical != null) {
    return bankMatch.estimated_inr_per_point_typical;
  }
  const anyBank = valuations.find((v) => v.bank_id === card.bank_id);
  if (anyBank?.estimated_inr_per_point_typical != null) {
    return anyBank.estimated_inr_per_point_typical;
  }
  const generic = valuations.find(
    (v) => v.bank_id === null && normalizeRt(v.reward_type) === rt,
  );
  if (generic?.estimated_inr_per_point_typical != null) {
    return generic.estimated_inr_per_point_typical;
  }
  return rt === 'miles' ? 0.75 : 0.25;
}

function normalizeRt(s: string): RewardType {
  const l = s.toLowerCase();
  if (l.includes('cash')) return 'cashback';
  if (l.includes('mile')) return 'miles';
  if (l.includes('hybrid')) return 'hybrid';
  return 'points';
}

/**
 * Effective ₹-value returned per ₹100 spent in a given category for a card.
 * - cashback rows use rate_pct directly (5% -> ₹5 per ₹100).
 * - points/miles rows: multiplier is treated as "Nx the base points"; we
 *   approximate the ₹ value as multiplier × base_reward_value_inr_per_100.
 *   If a rate_pct is present on a points row, use it × inrPerPoint.
 * - falls back to the card's base_reward_value_inr_per_100 when no category row
 *   matches (uncovered category), or 0 when even that is unknown.
 */
export function categoryValuePer100(
  card: CardLike,
  categoryKey: SpendCategoryKey,
  rewardCats: RewardCatRow[],
  perPoint: number,
): number {
  const base = card.base_reward_value_inr_per_100 ?? 0;
  const row = bestRowForCategory(card.id, categoryKey, rewardCats);
  if (!row) return base;

  if (card.reward_type === 'cashback') {
    if (row.rate_pct != null) return row.rate_pct; // ₹ per ₹100 == pct
    if (row.multiplier != null && base > 0) return row.multiplier * base;
    return base;
  }
  // points / miles / hybrid
  if (row.rate_pct != null) {
    // rate_pct expresses points-value as a %, convert via perPoint already
    // baked into base when derived; treat as ₹ per ₹100 directly here.
    return row.rate_pct;
  }
  if (row.multiplier != null && base > 0) return row.multiplier * base;
  return base;
}

function bestRowForCategory(
  cardId: string,
  categoryKey: SpendCategoryKey,
  rewardCats: RewardCatRow[],
): RewardCatRow | null {
  const rows = rewardCats.filter(
    (r) => r.card_id === cardId && r.category_key === categoryKey,
  );
  if (rows.length === 0) return null;
  // pick the richest row (highest rate_pct or multiplier).
  return rows.sort((a, b) => rowRank(b) - rowRank(a))[0];
}

function rowRank(r: RewardCatRow): number {
  return (r.rate_pct ?? 0) + (r.multiplier ?? 0);
}
