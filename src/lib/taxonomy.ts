/*
 * Canonical taxonomies & enums — the single source of truth shared by the
 * frontend, the Edge Functions, and the import/enrich scripts. Keep these in
 * sync with BACKEND_PROMPT.md §2 (spend categories), §6 (content categories),
 * and §9 (recommend / combo / best-card input enums). Do NOT invent new keys.
 */

/* ---- §2 Spend-category taxonomy (reward-rate math) ---- */
/* Used in card_reward_categories.category_key, the recommendation quiz, the
   combo optimizer, and the best-card calculator. Fixed, exhaustive list. */
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

export const SPEND_CATEGORY_LABELS: Record<SpendCategoryKey, string> = {
  general: 'General spends',
  groceries: 'Groceries',
  online_shopping: 'Online shopping',
  dining: 'Dining',
  travel_flights: 'Flights & travel',
  travel_hotels: 'Hotels',
  fuel: 'Fuel',
  utility_bills: 'Utility bills',
  emi_large_purchases: 'Large purchases (EMI)',
  entertainment: 'Entertainment',
  other: 'Other',
};

/* ---- §6 Content / nav category taxonomy (seed for `categories`) ---- */
/* Drives /best/[category-slug]. A card may belong to more than one.
   Deliberately NO "0% APR" — DESIGN.md §10.9 (use "Low Interest"). */
export const CONTENT_CATEGORIES = [
  { slug: 'cashback', name: 'Cashback' },
  { slug: 'travel', name: 'Travel' },
  { slug: 'rewards', name: 'Rewards' },
  { slug: 'fuel', name: 'Fuel' },
  { slug: 'lifetime-free', name: 'Lifetime Free' },
  { slug: 'business', name: 'Business' },
  { slug: 'low-interest', name: 'Low Interest' },
  { slug: 'student', name: 'Student' },
  { slug: 'super-premium', name: 'Super Premium' },
  { slug: 'airport-lounge', name: 'Airport Lounge' },
  { slug: 'dining', name: 'Dining' },
  { slug: 'shopping', name: 'Shopping' },
] as const;
export type ContentCategorySlug = (typeof CONTENT_CATEGORIES)[number]['slug'];

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
/* Monthly-spend-band midpoints (INR/month) for annual-value estimates (§9.1.2b). */
export const MONTHLY_SPEND_MIDPOINT: Record<MonthlySpendBand, number> = {
  lt20k: 12000,
  '20k_50k': 35000,
  '50k_1l': 75000,
  '1l_3l': 200000,
  '3l_plus': 400000,
};

/* Annual-income-band floors (INR/year), normalized to annual for the §9.1
   hard eligibility filter against card_eligibility.min_income_amount. */
export const ANNUAL_INCOME_FLOOR: Record<AnnualIncomeBand, number> = {
  lt3l: 0,
  '3_6l': 300000,
  '6_12l': 600000,
  '12_25l': 1200000,
  '25l_plus': 2500000,
};

/* CIBIL-band floor scores for the §9.1 hard filter (cards.cibil_min). */
export const CIBIL_BAND_FLOOR: Record<Exclude<CibilBand, 'not_sure' | 'new_to_credit'>, number> = {
  '750_plus': 750,
  '700_749': 700,
  '650_699': 650,
};

export type RewardType = 'points' | 'cashback' | 'miles' | 'hybrid';
export type DataConfidence = 'verified' | 'partially_estimated' | 'estimated';
export type CardNetwork = 'visa' | 'mastercard' | 'rupay' | 'amex' | 'diners';
