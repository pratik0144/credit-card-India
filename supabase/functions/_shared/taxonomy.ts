/*
 * Deno-side duplicate of the canonical taxonomy constants.
 * MUST match src/lib/taxonomy.ts byte-for-byte for the shared lists/enums.
 * Edge Functions can't import across the repo boundary at deploy time, so this
 * is a controlled copy — keep it in sync when src/lib/taxonomy.ts changes.
 */

/* ---- §2 Spend-category taxonomy (reward-rate math) ---- */
export const SPEND_CATEGORY_KEYS = [
  'general',
  'groceries',
  'online_shopping',
  'dining',
  'travel_flights',
  'travel_hotels',
  'fuel',
  'utility_bills',
  'emi_large_purchases',
  'entertainment',
  'other',
] as const;
export type SpendCategoryKey = (typeof SPEND_CATEGORY_KEYS)[number];

/* ---- §9.1 recommend-cards input enums ---- */
export const GOALS = [
  'cashback', 'travel_miles', 'rewards_points', 'fuel_savings',
  'first_card', 'business', 'lounge_access',
] as const;
export type Goal = (typeof GOALS)[number];

export const MONTHLY_SPEND_BANDS = ['lt20k', '20k_50k', '50k_1l', '1l_3l', '3l_plus'] as const;
export type MonthlySpendBand = (typeof MONTHLY_SPEND_BANDS)[number];

export const AIR_TRAVEL_FREQ = ['never', '1_2_year', '3_6_year', '7_plus_year'] as const;
export type AirTravelFrequency = (typeof AIR_TRAVEL_FREQ)[number];

export const EMPLOYMENT_TYPES = ['salaried', 'self_employed', 'student', 'not_employed'] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const ANNUAL_INCOME_BANDS = ['lt3l', '3_6l', '6_12l', '12_25l', '25l_plus'] as const;
export type AnnualIncomeBand = (typeof ANNUAL_INCOME_BANDS)[number];

export const CIBIL_BANDS = ['750_plus', '700_749', '650_699', 'new_to_credit', 'not_sure'] as const;
export type CibilBand = (typeof CIBIL_BANDS)[number];

export const FEE_PREFERENCES = ['lifetime_free_only', 'value_over_3x', 'no_preference'] as const;
export type FeePreference = (typeof FEE_PREFERENCES)[number];

/* ---- Band → representative numeric floors/midpoints (shared math) ---- */
export const MONTHLY_SPEND_MIDPOINT: Record<MonthlySpendBand, number> = {
  lt20k: 12000,
  '20k_50k': 35000,
  '50k_1l': 75000,
  '1l_3l': 200000,
  '3l_plus': 400000,
};

export const ANNUAL_INCOME_FLOOR: Record<AnnualIncomeBand, number> = {
  lt3l: 0,
  '3_6l': 300000,
  '6_12l': 600000,
  '12_25l': 1200000,
  '25l_plus': 2500000,
};

export const CIBIL_BAND_FLOOR: Record<'750_plus' | '700_749' | '650_699', number> = {
  '750_plus': 750,
  '700_749': 700,
  '650_699': 650,
};

export type RewardType = 'points' | 'cashback' | 'miles' | 'hybrid';

/* Map the recommend-cards employment_type ('not_employed') to the
   card_eligibility employment enum ('any' is the catch-all match). */
export function eligibilityEmploymentMatch(
  userType: EmploymentType,
): ('salaried' | 'self_employed' | 'student' | 'any')[] {
  // A card row matches the user if its employment_type is 'any' or equals the
  // user's declared type. 'not_employed' users only match 'any' cards.
  if (userType === 'not_employed') return ['any'];
  return [userType, 'any'];
}
