/*
 * Seed data — hand-derived from bank-data/cc-data/Master-data-banks.json.
 * Used by src/lib/queries.ts whenever `hasSupabaseEnv` is false (no live DB
 * this session) so every page renders real-looking content and `astro build`
 * succeeds. 12 real cards across 6 banks (exceeds FRONTEND §17 DoD of 5/3).
 *
 * Fidelity notes:
 *  - Fees, reward-rate text, eligibility, lounge counts, official URLs and card
 *    art are copied verbatim from the source JSON.
 *  - `card_reward_categories`, `card_ratings`, `card_bonuses`, `articles` and
 *    `point_valuations` are editorial/enrichment layers the backend would
 *    populate (BACKEND §7.2, §4.2, §4.5). Here they are hand-authored and every
 *    estimated field is marked honestly via `estimated_fields` / `is_estimated`
 *    / `needs_review`, matching the "don't collapse the (est) signal" rule.
 *  - editorial_score_5 = raw "/10" score ÷ 2 (BACKEND §7.1.5).
 */
import type {
  Bank, Category, Card, CardRewardCategory, CardBonus, CardFee, CardEligibility,
  CardRating, CardChangeLog, Author, Article, PointValuation, CardListingRow,
} from './database.types';
import { CONTENT_CATEGORIES } from './taxonomy';

/* ---------------------------------------------------------------- Banks -- */
export const banks: Bank[] = [
  { id: 'bank-hdfc', slug: 'hdfc-bank', name: 'HDFC Bank', logo_url: null,
    official_website: 'https://www.hdfcbank.com',
    about: 'HDFC Bank is India’s largest private-sector bank by assets and one of the most prolific credit-card issuers in the country, with a card portfolio spanning entry-level cashback cards to super-premium travel and lifestyle products.',
    is_scheduled_commercial_bank: true },
  { id: 'bank-axis', slug: 'axis-bank', name: 'Axis Bank', logo_url: null,
    official_website: 'https://www.axisbank.com',
    about: 'Axis Bank is the third-largest private-sector bank in India and issues a well-regarded range of travel and rewards credit cards, including the miles-focused Atlas line.',
    is_scheduled_commercial_bank: true },
  { id: 'bank-sbi', slug: 'sbi-card', name: 'State Bank of India', logo_url: null,
    official_website: 'https://www.sbicard.com',
    about: 'SBI Card, a subsidiary of India’s largest public-sector bank, is one of the country’s largest pure-play credit-card issuers with strong reach into first-time and value-focused cardholders.',
    is_scheduled_commercial_bank: true },
  { id: 'bank-icici', slug: 'icici-bank', name: 'ICICI Bank', logo_url: null,
    official_website: 'https://www.icicibank.com',
    about: 'ICICI Bank is a leading private-sector bank whose co-branded cards — notably the Amazon Pay ICICI card — are among the most widely held credit cards in India.',
    is_scheduled_commercial_bank: true },
  { id: 'bank-idfc', slug: 'idfc-first-bank', name: 'IDFC FIRST Bank', logo_url: null,
    official_website: 'https://www.idfcfirstbank.com',
    about: 'IDFC FIRST Bank has built its card proposition around lifetime-free, never-expiring rewards and low forex markups, positioning aggressively against fee-charging incumbents.',
    is_scheduled_commercial_bank: true },
  { id: 'bank-amex', slug: 'american-express', name: 'American Express', logo_url: null,
    official_website: 'https://www.americanexpress.com/in',
    about: 'American Express operates as a bank in India (American Express Banking Corp.) and issues its own Membership Rewards–based charge and credit cards aimed at frequent-spend and travel customers.',
    is_scheduled_commercial_bank: true },
];

const bankById = Object.fromEntries(banks.map((b) => [b.id, b]));
const bankBySlug = Object.fromEntries(banks.map((b) => [b.slug, b]));

/* ------------------------------------------------------------ Categories -- */
export const categories: Category[] = CONTENT_CATEGORIES.map((c, i) => ({
  id: `cat-${c.slug}`,
  slug: c.slug,
  name: c.name,
  description: null,
  display_order: i,
}));

/* --------------------------------------------------------- Card helpers --- */
type SeedCard = Card & {
  /** content-category slugs this card belongs to (junction card_categories) */
  category_slugs: string[];
  primary_category_slug: string;
  /** derived one-line headline reward for listing rows */
  headline_reward_line: string;
};

function raw(source: Record<string, unknown>): Record<string, unknown> {
  return source;
}

/* --------------------------------------------------------------- Cards --- */
export const cards: SeedCard[] = [
  {
    id: 'card-hdfc-millennia', bank_id: 'bank-hdfc', slug: 'hdfc-bank-millennia-credit-card',
    name: 'Millennia Credit Card', image_url: '/card-img/023_hdfc_Millennia-Credit-Card.png',
    card_type: 'credit', network: 'rupay', network_is_estimated: false, tier: 'Mid-Range',
    official_url: 'https://www.hdfc.bank.in/credit-cards/millennia-credit-card',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 1000, joining_fee_raw: 'Rs. 1000',
    annual_fee_amount: 1000, annual_fee_raw: 'Rs. 1000',
    annual_fee_waiver_spend_amount: 100000, annual_fee_waiver_spend_raw: 'Rs. 1,00,000',
    forex_markup_pct: 3.5, reward_type: 'cashback',
    reward_rate_general_text: '5% cashback on Amazon, Flipkart, Myntra and select online merchants; 1% on all other spends',
    base_reward_value_inr_per_100: 1.0,
    fuel_surcharge_waiver_text: '1% fuel surcharge waiver (min. spend Rs. 400, max cap varies)',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: 4,
    lounge_domestic_text: '4 per year', lounge_intl_visits_per_year: null,
    lounge_intl_network: null, lounge_intl_text: 'Not Applicable',
    supports_contactless: true, supports_upi: true, age_min: 21, age_max: 40,
    cibil_min: 750, cibil_min_is_estimated: true,
    editorial_score_raw: '8.0/10', editorial_score_5: 4.0,
    data_confidence: 'partially_estimated',
    raw_source: raw({ bank_name: 'HDFC Bank', card_name: 'Millennia Credit Card' }),
    estimated_fields: ['cibil_min'], is_active: true,
    category_slugs: ['cashback', 'shopping'], primary_category_slug: 'cashback',
    headline_reward_line: '5% cashback on top online merchants',
  },
  {
    id: 'card-hdfc-regalia-gold', bank_id: 'bank-hdfc', slug: 'hdfc-bank-regalia-gold-credit-card',
    name: 'Regalia Gold Credit Card', image_url: '/card-img/036_hdfc_Regalia-Gold-Credit-Card.png',
    card_type: 'credit', network: 'rupay', network_is_estimated: false, tier: 'Premium',
    official_url: 'https://www.hdfc.bank.in/credit-cards/regalia-gold-credit-card',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 2500, joining_fee_raw: 'Rs. 2500',
    annual_fee_amount: 2500, annual_fee_raw: 'Rs. 2500',
    annual_fee_waiver_spend_amount: 400000, annual_fee_waiver_spend_raw: 'Rs. 4,00,000',
    forex_markup_pct: 2, reward_type: 'points',
    reward_rate_general_text: '5 Reward Points on every ₹200 spent; accelerated rewards on SmartBuy & PayZapp (up to 10X)',
    base_reward_value_inr_per_100: 1.6,
    fuel_surcharge_waiver_text: '1% fuel surcharge waiver (min. spend Rs. 400, max cap varies)',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: 12,
    lounge_domestic_text: '3 visits per quarter (spend-based: requires ₹60,000 spend in preceding calendar quarter — effective July 2026)',
    lounge_intl_visits_per_year: 6, lounge_intl_network: 'Priority Pass',
    lounge_intl_text: '6 per year', supports_contactless: true, supports_upi: false,
    age_min: 21, age_max: 65, cibil_min: 750, cibil_min_is_estimated: false,
    editorial_score_raw: '8.5/10', editorial_score_5: 4.3,
    data_confidence: 'verified',
    raw_source: raw({ bank_name: 'HDFC Bank', card_name: 'Regalia Gold Credit Card' }),
    estimated_fields: [], is_active: true,
    category_slugs: ['rewards', 'travel', 'airport-lounge'], primary_category_slug: 'rewards',
    headline_reward_line: 'Up to 10X points on SmartBuy',
  },
  {
    id: 'card-hdfc-moneyback', bank_id: 'bank-hdfc', slug: 'hdfc-bank-moneyback-credit-card',
    name: 'MoneyBack Credit Card', image_url: '/card-img/024_hdfc_MoneyBack-Credit-Card.png',
    card_type: 'credit', network: 'visa', network_is_estimated: false, tier: 'Entry Level',
    official_url: 'https://www.hdfcbank.com/credit-cards/money-back-credit-card',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 500, joining_fee_raw: 'Rs. 500',
    annual_fee_amount: 0, annual_fee_raw: 'Rs. 0',
    annual_fee_waiver_spend_amount: 0, annual_fee_waiver_spend_raw: 'Rs. 0',
    forex_markup_pct: 3.5, reward_type: 'hybrid',
    reward_rate_general_text: '2X Reward Points on every ₹200 spent online; accelerated rewards on SmartBuy & PayZapp',
    base_reward_value_inr_per_100: 0.5,
    fuel_surcharge_waiver_text: '1% fuel surcharge waiver on ₹400–₹5,000 transactions. Max waiver ₹250 per statement cycle.',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: null,
    lounge_domestic_text: 'Not Applicable', lounge_intl_visits_per_year: null,
    lounge_intl_network: null, lounge_intl_text: 'Not Applicable',
    supports_contactless: true, supports_upi: true, age_min: 21, age_max: 65,
    cibil_min: 700, cibil_min_is_estimated: true,
    editorial_score_raw: '7.5/10', editorial_score_5: 3.8,
    data_confidence: 'partially_estimated',
    raw_source: raw({ bank_name: 'HDFC Bank', card_name: 'MoneyBack Credit Card' }),
    estimated_fields: ['cibil_min', 'minimum_income'], is_active: true,
    category_slugs: ['rewards'], primary_category_slug: 'rewards',
    headline_reward_line: '2X points on online spends',
  },
  {
    id: 'card-hdfc-swiggy', bank_id: 'bank-hdfc', slug: 'hdfc-bank-swiggy-credit-card',
    name: 'Swiggy HDFC Bank Credit Card', image_url: '/card-img/044_hdfc_Swiggy-HDFC-Bank-Credit-Card.png',
    card_type: 'credit', network: 'visa', network_is_estimated: false, tier: 'Entry Level',
    official_url: 'https://www.hdfc.bank.in/credit-cards/swiggy-hdfc-bank-credit-card',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 500, joining_fee_raw: 'Rs. 500',
    annual_fee_amount: 500, annual_fee_raw: 'Rs. 500',
    annual_fee_waiver_spend_amount: 50000, annual_fee_waiver_spend_raw: 'Rs. 50,000',
    forex_markup_pct: 3.5, reward_type: 'cashback',
    reward_rate_general_text: '10% cashback on Swiggy, 5% on online spends, 1% on all other categories',
    base_reward_value_inr_per_100: 1.0,
    fuel_surcharge_waiver_text: '1% fuel surcharge waiver (min. spend Rs. 400, max cap varies)',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: null,
    lounge_domestic_text: 'Not Applicable', lounge_intl_visits_per_year: null,
    lounge_intl_network: null, lounge_intl_text: 'Not Applicable',
    supports_contactless: true, supports_upi: true, age_min: 21, age_max: 60,
    cibil_min: 720, cibil_min_is_estimated: true,
    editorial_score_raw: '8.0/10', editorial_score_5: 4.0,
    data_confidence: 'partially_estimated',
    raw_source: raw({ bank_name: 'HDFC Bank', card_name: 'Swiggy HDFC Bank Credit Card' }),
    estimated_fields: ['cibil_min'], is_active: true,
    category_slugs: ['cashback', 'dining'], primary_category_slug: 'cashback',
    headline_reward_line: '10% cashback on Swiggy orders',
  },
  {
    id: 'card-axis-atlas', bank_id: 'bank-axis', slug: 'axis-bank-atlas-credit-card',
    name: 'Axis Atlas Credit Card', image_url: '/card-img/125_axis_ATLAS-Credit-Card.png',
    card_type: 'credit', network: 'visa', network_is_estimated: false,
    tier: 'Luxury Travel / Miles Elite',
    official_url: 'https://www.axisbank.com/cards/credit-card/axis-bank-atlas-credit-card',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 5000, joining_fee_raw: '₹5,000 + GST',
    annual_fee_amount: 5000, annual_fee_raw: '₹5,000 + GST',
    annual_fee_waiver_spend_amount: null,
    annual_fee_waiver_spend_raw: 'No traditional waiver — tier-based milestone EDGE Miles awarded on fee payment',
    forex_markup_pct: 3.5, reward_type: 'miles',
    reward_rate_general_text: '2 EDGE Miles per ₹100 on general spends; 5 EDGE Miles per ₹100 on direct airline & hotel bookings',
    base_reward_value_inr_per_100: 2.0,
    fuel_surcharge_waiver_text: '1% fuel surcharge waiver',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: 8,
    lounge_domestic_text: 'Tier-based: Silver (8), Gold (12), Platinum (18) visits per year',
    lounge_intl_visits_per_year: 4, lounge_intl_network: 'Priority Pass',
    lounge_intl_text: 'Tier-based: Silver (4), Gold (8), Platinum (18) per year via Priority Pass',
    supports_contactless: true, supports_upi: false, age_min: 21, age_max: 65,
    cibil_min: 750, cibil_min_is_estimated: false,
    editorial_score_raw: '8.2/10', editorial_score_5: 4.1,
    data_confidence: 'verified',
    raw_source: raw({ bank_name: 'Axis Bank', card_name: 'ATLAS Credit Card' }),
    estimated_fields: [], is_active: true,
    category_slugs: ['travel', 'airport-lounge', 'super-premium'], primary_category_slug: 'travel',
    headline_reward_line: '5 EDGE Miles per ₹100 on travel',
  },
  {
    id: 'card-axis-magnus', bank_id: 'bank-axis', slug: 'axis-bank-magnus-credit-card',
    name: 'Axis Bank Magnus Credit Card', image_url: '/card-img/130_axis_Axis-Bank-Magnus-Credit-Card.png',
    card_type: 'credit', network: 'visa', network_is_estimated: false, tier: 'Super Premium / Luxury',
    official_url: 'https://www.axisbank.com/cards/credit-card/axis-bank-magnus-credit-card',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 12500, joining_fee_raw: '₹12,500 + GST',
    annual_fee_amount: 12500, annual_fee_raw: '₹12,500 + GST',
    annual_fee_waiver_spend_amount: 2500000,
    annual_fee_waiver_spend_raw: '₹25,00,000 annual spend (excludes wallet, utilities, gold, insurance, fuel, EMI, government, rent)',
    forex_markup_pct: 2, reward_type: 'points',
    reward_rate_general_text: '12 EDGE points per ₹200 up to ₹1.5L/month; 35 points per ₹200 on incremental spends; 5X on Travel EDGE portal',
    base_reward_value_inr_per_100: 4.8,
    fuel_surcharge_waiver_text: '1% waiver for ₹400–₹4,000 transactions (capped at ₹400/month)',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: 999,
    lounge_domestic_text: 'Unlimited domestic lounge access for primary cardholder + 4 guest visits/year',
    lounge_intl_visits_per_year: 999, lounge_intl_network: 'Priority Pass',
    lounge_intl_text: 'Unlimited international lounge access via Priority Pass + 8 guest visits/year',
    supports_contactless: true, supports_upi: false, age_min: 21, age_max: 65,
    cibil_min: 750, cibil_min_is_estimated: false,
    editorial_score_raw: '8.8/10', editorial_score_5: 4.4,
    data_confidence: 'verified',
    raw_source: raw({ bank_name: 'Axis Bank', card_name: 'Axis Bank Magnus Credit Card' }),
    estimated_fields: [], is_active: true,
    category_slugs: ['super-premium', 'travel', 'airport-lounge', 'rewards'], primary_category_slug: 'super-premium',
    headline_reward_line: 'Unlimited lounge access + rich rewards',
  },
  {
    id: 'card-sbi-cashback', bank_id: 'bank-sbi', slug: 'sbi-card-cashback-sbi-card',
    name: 'CASHBACK SBI Card', image_url: '/card-img/056_sbi_CASHBACK-SBI-Card.png',
    card_type: 'credit', network: 'visa', network_is_estimated: false, tier: 'Mid-Range',
    official_url: 'https://www.sbicard.com/en/personal/credit-cards/cashback-sbi-card.page',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 999, joining_fee_raw: 'Rs. 999',
    annual_fee_amount: 999, annual_fee_raw: 'Rs. 999',
    annual_fee_waiver_spend_amount: 200000, annual_fee_waiver_spend_raw: 'Rs. 2,00,000',
    forex_markup_pct: 3.5, reward_type: 'cashback',
    reward_rate_general_text: '5% cashback on online spends (capped ₹2,000/cycle); 1% on offline spends',
    base_reward_value_inr_per_100: 1.0,
    fuel_surcharge_waiver_text: '1% fuel surcharge waiver on ₹500–₹3,000 transactions (max ₹100/cycle)',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: null,
    lounge_domestic_text: 'Not Applicable', lounge_intl_visits_per_year: null,
    lounge_intl_network: null, lounge_intl_text: 'Not Applicable',
    supports_contactless: true, supports_upi: false, age_min: 21, age_max: 65,
    cibil_min: 750, cibil_min_is_estimated: false,
    editorial_score_raw: '9.0/10', editorial_score_5: 4.5,
    data_confidence: 'verified',
    raw_source: raw({ bank_name: 'State Bank of India', card_name: 'CASHBACK SBI Card' }),
    estimated_fields: [], is_active: true,
    category_slugs: ['cashback', 'shopping'], primary_category_slug: 'cashback',
    headline_reward_line: '5% cashback on all online spends',
  },
  {
    id: 'card-sbi-simplyclick', bank_id: 'bank-sbi', slug: 'sbi-card-simplyclick-sbi-card',
    name: 'SimplyCLICK SBI Card', image_url: '/card-img/057_sbi_SimplyCLICK-SBI-Card.png',
    card_type: 'credit', network: 'visa', network_is_estimated: false, tier: 'Entry Level',
    official_url: 'https://www.sbicard.com/en/personal/credit-cards/simplyclick-sbi-card.page',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 499, joining_fee_raw: 'Rs. 499',
    annual_fee_amount: 499, annual_fee_raw: 'Rs. 499',
    annual_fee_waiver_spend_amount: 100000, annual_fee_waiver_spend_raw: 'Rs. 1,00,000',
    forex_markup_pct: 3.5, reward_type: 'points',
    reward_rate_general_text: '10X points on Apollo 24x7, BookMyShow, Cleartrip, Myntra & partners; 5X on other online spends; 1 point per ₹100 otherwise',
    base_reward_value_inr_per_100: 0.25,
    fuel_surcharge_waiver_text: '1% waiver',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: null,
    lounge_domestic_text: 'Not Applicable', lounge_intl_visits_per_year: null,
    lounge_intl_network: null, lounge_intl_text: 'Not Applicable',
    supports_contactless: true, supports_upi: false, age_min: 21, age_max: 65,
    cibil_min: 750, cibil_min_is_estimated: false,
    editorial_score_raw: '7.5/10', editorial_score_5: 3.8,
    data_confidence: 'verified',
    raw_source: raw({ bank_name: 'State Bank of India', card_name: 'SimplyCLICK SBI Card' }),
    estimated_fields: [], is_active: true,
    category_slugs: ['shopping', 'rewards'], primary_category_slug: 'shopping',
    headline_reward_line: '10X points on partner online stores',
  },
  {
    id: 'card-icici-amazonpay', bank_id: 'bank-icici', slug: 'icici-bank-amazon-pay-credit-card',
    name: 'Amazon Pay ICICI Bank Credit Card', image_url: '/card-img/093_icici_Amazon-Pay-ICICI-Bank-Credit-Card.png',
    card_type: 'credit', network: 'visa', network_is_estimated: false, tier: 'Co-branded / Platinum',
    official_url: 'https://www.icici.bank.in/personal-banking/cards/credit-card/amazon-pay-credit-card',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 0, joining_fee_raw: 'Nil',
    annual_fee_amount: 0, annual_fee_raw: 'Nil',
    annual_fee_waiver_spend_amount: 0, annual_fee_waiver_spend_raw: 'Lifetime Free',
    forex_markup_pct: 3.5, reward_type: 'cashback',
    reward_rate_general_text: '5% cashback for Amazon Prime members on Amazon; 3% for non-Prime; 2% on bills & recharges; 1% on all other spends',
    base_reward_value_inr_per_100: 1.0,
    fuel_surcharge_waiver_text: '1% fuel surcharge waiver across all pumps in India',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: null,
    lounge_domestic_text: 'Not Applicable', lounge_intl_visits_per_year: null,
    lounge_intl_network: null, lounge_intl_text: 'Not Applicable',
    supports_contactless: true, supports_upi: true, age_min: 21, age_max: 65,
    cibil_min: 750, cibil_min_is_estimated: false,
    editorial_score_raw: '9.0/10', editorial_score_5: 4.5,
    data_confidence: 'verified',
    raw_source: raw({ bank_name: 'ICICI Bank', card_name: 'Amazon Pay ICICI Bank Credit Card' }),
    estimated_fields: [], is_active: true,
    category_slugs: ['cashback', 'lifetime-free', 'shopping'], primary_category_slug: 'lifetime-free',
    headline_reward_line: '5% back on Amazon for Prime members',
  },
  {
    id: 'card-idfc-first-millennia', bank_id: 'bank-idfc', slug: 'idfc-first-bank-first-millennia-credit-card',
    name: 'FIRST Millennia Credit Card', image_url: '/card-img/255_idfc_FIRST-Millennia-Credit-Card.png',
    card_type: 'credit', network: 'visa', network_is_estimated: false, tier: 'Entry-level — Lifetime Free',
    official_url: 'https://www.idfcfirst.bank.in/credit-card/millennia',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 0, joining_fee_raw: 'Lifetime Free',
    annual_fee_amount: 0, annual_fee_raw: 'Lifetime Free',
    annual_fee_waiver_spend_amount: null, annual_fee_waiver_spend_raw: 'N/A',
    forex_markup_pct: 3.5, reward_type: 'points',
    reward_rate_general_text: '3X points per ₹150 up to ₹20,000/month; 10X above ₹20,000 & on birthday spends; never-expiring points',
    base_reward_value_inr_per_100: 0.5,
    fuel_surcharge_waiver_text: '1% fuel surcharge waiver up to ₹200 (est)',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: null,
    lounge_domestic_text: 'N/A', lounge_intl_visits_per_year: null,
    lounge_intl_network: null, lounge_intl_text: 'N/A',
    supports_contactless: true, supports_upi: true, age_min: 21, age_max: 65,
    cibil_min: 750, cibil_min_is_estimated: true,
    editorial_score_raw: '7.2/10', editorial_score_5: 3.6,
    data_confidence: 'partially_estimated',
    raw_source: raw({ bank_name: 'IDFC FIRST Bank', card_name: 'FIRST Millennia Credit Card' }),
    estimated_fields: ['cibil_min', 'fuel_surcharge_waiver'], is_active: true,
    category_slugs: ['lifetime-free', 'rewards'], primary_category_slug: 'lifetime-free',
    headline_reward_line: 'Up to 10X never-expiring points',
  },
  {
    id: 'card-idfc-first-select', bank_id: 'bank-idfc', slug: 'idfc-first-bank-first-select-credit-card',
    name: 'FIRST Select Credit Card', image_url: '/card-img/254_idfc_FIRST-Select-Credit-Card.png',
    card_type: 'credit', network: 'visa', network_is_estimated: false, tier: 'Mid-range — Lifetime Free',
    official_url: 'https://www.idfcfirst.bank.in/credit-card/select',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 0, joining_fee_raw: 'Lifetime Free',
    annual_fee_amount: 0, annual_fee_raw: 'Lifetime Free',
    annual_fee_waiver_spend_amount: null, annual_fee_waiver_spend_raw: 'N/A',
    forex_markup_pct: 1.99, reward_type: 'points',
    reward_rate_general_text: '3X points per ₹150 up to ₹20,000/month; 10X above ₹20,000 & on birthday spends; low 1.99% forex markup',
    base_reward_value_inr_per_100: 0.5,
    fuel_surcharge_waiver_text: '1% fuel surcharge waiver up to ₹300 (est)',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: 8,
    lounge_domestic_text: '2 per quarter; requires ₹20,000 spend in prior month',
    lounge_intl_visits_per_year: null, lounge_intl_network: null, lounge_intl_text: 'N/A',
    supports_contactless: true, supports_upi: true, age_min: 21, age_max: 65,
    cibil_min: 750, cibil_min_is_estimated: true,
    editorial_score_raw: '7.8/10', editorial_score_5: 3.9,
    data_confidence: 'partially_estimated',
    raw_source: raw({ bank_name: 'IDFC FIRST Bank', card_name: 'FIRST Select Credit Card' }),
    estimated_fields: ['cibil_min', 'fuel_surcharge_waiver'], is_active: true,
    category_slugs: ['lifetime-free', 'travel', 'airport-lounge'], primary_category_slug: 'lifetime-free',
    headline_reward_line: 'Lifetime-free with 1.99% forex & lounges',
  },
  {
    id: 'card-amex-platinum-travel', bank_id: 'bank-amex', slug: 'american-express-platinum-travel-credit-card',
    name: 'American Express Platinum Travel Credit Card', image_url: '/card-img/316_amex_American-Express-Platinum-Travel-Credit-Card.png',
    card_type: 'credit', network: 'amex', network_is_estimated: false, tier: 'Premium',
    official_url: 'https://www.americanexpress.com/in/credit-cards/platinum-travel-credit-card/',
    last_verified_at: '2026-06-07T00:00:00+00:00',
    joining_fee_amount: 5000, joining_fee_raw: 'Rs. 5,000 + GST',
    annual_fee_amount: 5000, annual_fee_raw: 'Rs. 5,000 + GST',
    annual_fee_waiver_spend_amount: null,
    annual_fee_waiver_spend_raw: 'N/A (milestone-driven value instead of a fee waiver)',
    forex_markup_pct: 3.5, reward_type: 'points',
    reward_rate_general_text: '1 Membership Rewards point per ₹50 (approx. 0.5% base); value is milestone-driven',
    base_reward_value_inr_per_100: 0.5,
    fuel_surcharge_waiver_text: 'HPCL: 0% under ₹5,000, 1% above',
    fuel_surcharge_waiver_pct: 1, lounge_domestic_visits_per_year: 8,
    lounge_domestic_text: '8 complimentary visits/year (max 2 per quarter) at Indian airport lounges',
    lounge_intl_visits_per_year: null, lounge_intl_network: 'Priority Pass',
    lounge_intl_text: 'Complimentary Priority Pass membership (per-visit usage fee applies)',
    supports_contactless: true, supports_upi: false, age_min: 18, age_max: 65,
    cibil_min: 750, cibil_min_is_estimated: true,
    editorial_score_raw: '8.3/10', editorial_score_5: 4.2,
    data_confidence: 'partially_estimated',
    raw_source: raw({ bank_name: 'American Express', card_name: 'American Express Platinum Travel Credit Card' }),
    estimated_fields: ['cibil_min', 'age_min'], is_active: true,
    category_slugs: ['travel', 'rewards', 'airport-lounge'], primary_category_slug: 'travel',
    headline_reward_line: 'Rich milestone rewards for travellers',
  },
];

const cardById = Object.fromEntries(cards.map((c) => [c.id, c]));
const cardBySlug = Object.fromEntries(cards.map((c) => [c.slug, c]));

/* ---------------------------------------- Spend-category reward rates ----- */
/* Enrichment layer (BACKEND §7.2). parsed_by_llm/needs_review honesty kept. */
function rc(
  card_id: string, category_key: CardRewardCategory['category_key'],
  multiplier: number | null, rate_pct: number | null, raw_text: string,
): CardRewardCategory {
  return { card_id, category_key, multiplier, rate_pct, cap_amount: null, cap_period: null,
    raw_text, parsed_by_llm: true, needs_review: false };
}
export const cardRewardCategories: CardRewardCategory[] = [
  rc('card-hdfc-millennia', 'online_shopping', null, 5, '5% cashback on Amazon, Flipkart, Myntra'),
  rc('card-hdfc-millennia', 'general', null, 1, '1% on all other spends'),
  rc('card-hdfc-regalia-gold', 'general', null, 2.5, '5 RP per ₹200 (≈ 2.5% via SmartBuy)'),
  rc('card-hdfc-regalia-gold', 'travel_flights', null, 5, 'Accelerated points on SmartBuy travel'),
  rc('card-hdfc-moneyback', 'online_shopping', 2, null, '2X points on online spends'),
  rc('card-hdfc-moneyback', 'general', 1, null, '1X on all other spends'),
  rc('card-hdfc-swiggy', 'dining', null, 10, '10% cashback on Swiggy'),
  rc('card-hdfc-swiggy', 'online_shopping', null, 5, '5% on online spends'),
  rc('card-hdfc-swiggy', 'general', null, 1, '1% on all other categories'),
  rc('card-axis-atlas', 'travel_flights', null, 5, '5 EDGE Miles per ₹100 on airline & hotel bookings'),
  rc('card-axis-atlas', 'travel_hotels', null, 5, '5 EDGE Miles per ₹100 on hotel bookings'),
  rc('card-axis-atlas', 'general', null, 2, '2 EDGE Miles per ₹100 general'),
  rc('card-axis-magnus', 'travel_flights', null, 5, '5X on Axis Travel EDGE portal'),
  rc('card-axis-magnus', 'general', null, 4.8, '12–35 EDGE points per ₹200'),
  rc('card-sbi-cashback', 'online_shopping', null, 5, '5% cashback on online spends'),
  rc('card-sbi-cashback', 'general', null, 1, '1% on offline spends'),
  rc('card-sbi-simplyclick', 'online_shopping', 10, null, '10X points on partner online stores'),
  rc('card-sbi-simplyclick', 'general', 1, null, '1 point per ₹100'),
  rc('card-icici-amazonpay', 'online_shopping', null, 5, '5% on Amazon for Prime members'),
  rc('card-icici-amazonpay', 'utility_bills', null, 2, '2% on bills & recharges'),
  rc('card-icici-amazonpay', 'general', null, 1, '1% on all other retail'),
  rc('card-idfc-first-millennia', 'general', 3, null, '3X points per ₹150'),
  rc('card-idfc-first-select', 'general', 3, null, '3X points per ₹150'),
  rc('card-amex-platinum-travel', 'general', null, 0.5, '1 MR point per ₹50'),
];

/* --------------------------------------------------------- Card bonuses --- */
function bonus(
  card_id: string, bonus_type: CardBonus['bonus_type'], description: string,
  threshold_spend_amount: number | null, estimated_value_inr: number | null, is_estimated: boolean,
): CardBonus {
  return { card_id, bonus_type, description, threshold_spend_amount, threshold_period: 'yearly',
    estimated_value_inr, is_estimated, valid_until: null, parsed_by_llm: true, needs_review: false };
}
export const cardBonuses: CardBonus[] = [
  bonus('card-hdfc-millennia', 'welcome', 'Welcome benefit worth the ₹1,000 joining fee in points/vouchers', null, 1000, false),
  bonus('card-hdfc-regalia-gold', 'welcome', 'Welcome benefit worth the ₹2,500 joining fee', null, 2500, false),
  bonus('card-hdfc-regalia-gold', 'milestone', 'Milestone vouchers on crossing annual spend thresholds', 400000, 5000, true),
  bonus('card-hdfc-swiggy', 'welcome', 'Complimentary 3-month Swiggy One membership', null, 1200, true),
  bonus('card-axis-atlas', 'welcome', '5,000 welcome EDGE Miles on card activation', null, 5000, false),
  bonus('card-axis-atlas', 'milestone', 'Up to 10,000 milestone bonus miles per year', 750000, 10000, false),
  bonus('card-axis-magnus', 'welcome', 'Luxury brand voucher or flight ticket worth ₹12,500', null, 12500, false),
  bonus('card-sbi-simplyclick', 'welcome', 'Amazon gift card worth ₹500 on joining', null, 500, false),
  bonus('card-amex-platinum-travel', 'welcome', '10,000 MR points on ₹15,000 spend within 90 days', 15000, 3000, false),
  bonus('card-amex-platinum-travel', 'milestone', '22,500 MR points + Taj voucher worth ₹10,000 on ₹7L annual spend', 700000, 17000, false),
];

/* ------------------------------------------------------------ Card fees --- */
function fee(
  card_id: string, fee_type: CardFee['fee_type'], amount: number | null,
  is_percentage: boolean, raw_text: string,
): CardFee {
  return { card_id, fee_type, amount, is_percentage, min_amount: null, max_amount: null, raw_text };
}
export const cardFees: CardFee[] = cards.flatMap((c) => [
  fee(c.id, 'joining', c.joining_fee_amount, false, c.joining_fee_raw ?? ''),
  fee(c.id, 'annual', c.annual_fee_amount, false, c.annual_fee_raw ?? ''),
  fee(c.id, 'forex_markup', c.forex_markup_pct, true, `${c.forex_markup_pct}% forex markup`),
]);

/* ---------------------------------------------------------- Eligibility --- */
export const cardEligibility: CardEligibility[] = [
  { card_id: 'card-hdfc-millennia', employment_type: 'salaried', min_income_amount: 35000, min_income_period: 'monthly', raw_text: '₹35,000/month (Salaried); ITR > ₹6L (Self-employed)' },
  { card_id: 'card-hdfc-regalia-gold', employment_type: 'salaried', min_income_amount: 100000, min_income_period: 'monthly', raw_text: '₹1,00,000/month (Salaried); ₹12L ITR (Self-employed)' },
  { card_id: 'card-hdfc-moneyback', employment_type: 'salaried', min_income_amount: 25000, min_income_period: 'monthly', raw_text: '₹25,000/month (Salaried) (est)' },
  { card_id: 'card-hdfc-swiggy', employment_type: 'salaried', min_income_amount: 25000, min_income_period: 'monthly', raw_text: '₹25,000–₹35,000/month (Salaried)' },
  { card_id: 'card-axis-atlas', employment_type: 'salaried', min_income_amount: 100000, min_income_period: 'monthly', raw_text: '₹1,00,000/month' },
  { card_id: 'card-axis-magnus', employment_type: 'salaried', min_income_amount: 1800000, min_income_period: 'annual', raw_text: '₹18L per annum (salaried or ITR)' },
  { card_id: 'card-sbi-cashback', employment_type: 'salaried', min_income_amount: 25000, min_income_period: 'monthly', raw_text: '₹25,000/month (Salaried)' },
  { card_id: 'card-sbi-simplyclick', employment_type: 'salaried', min_income_amount: 20000, min_income_period: 'monthly', raw_text: '₹20,000/month (Salaried)' },
  { card_id: 'card-icici-amazonpay', employment_type: 'salaried', min_income_amount: 25000, min_income_period: 'monthly', raw_text: '₹25,000/month' },
  { card_id: 'card-idfc-first-millennia', employment_type: 'salaried', min_income_amount: 300000, min_income_period: 'annual', raw_text: '₹3,00,000 per annum' },
  { card_id: 'card-idfc-first-select', employment_type: 'salaried', min_income_amount: 1200000, min_income_period: 'annual', raw_text: '₹12,00,000 per annum' },
  { card_id: 'card-amex-platinum-travel', employment_type: 'salaried', min_income_amount: 600000, min_income_period: 'annual', raw_text: '₹6,00,000 per annum' },
];

/* -------------------------------------------------------------- Ratings --- */
/* Editorial sub-scores (DESIGN §6.4). Anchored so overall = editorial_score_5. */
function rating(
  card_id: string, overall: number, rewards: number, fees: number,
  welcome: number, flex: number, service: number,
): CardRating {
  return { card_id, overall_score: overall, rewards_value_score: rewards, fees_charges_score: fees,
    welcome_benefit_score: welcome, flexibility_score: flex, issuer_service_score: service,
    methodology_note: 'Scored on our independent, issuer-blind rubric across rewards value, fees, welcome benefit, flexibility and issuer service. Issuers have no influence on these scores.',
    rated_by: 'author-priya', rated_at: '2026-06-20T00:00:00+00:00' };
}
export const cardRatings: CardRating[] = [
  rating('card-hdfc-millennia', 4.0, 4.5, 3.5, 3.5, 4.0, 4.0),
  rating('card-hdfc-regalia-gold', 4.3, 4.5, 3.5, 4.5, 4.5, 4.0),
  rating('card-hdfc-moneyback', 3.8, 3.5, 4.5, 3.0, 3.5, 4.0),
  rating('card-hdfc-swiggy', 4.0, 4.5, 3.5, 3.5, 3.5, 4.0),
  rating('card-axis-atlas', 4.1, 4.5, 3.5, 4.0, 4.0, 4.0),
  rating('card-axis-magnus', 4.4, 5.0, 3.0, 4.5, 4.5, 4.0),
  rating('card-sbi-cashback', 4.5, 4.5, 4.0, 4.0, 4.5, 4.5),
  rating('card-sbi-simplyclick', 3.8, 4.0, 4.0, 3.5, 3.5, 4.0),
  rating('card-icici-amazonpay', 4.5, 4.5, 5.0, 4.0, 4.5, 4.5),
  rating('card-idfc-first-millennia', 3.6, 3.5, 5.0, 3.0, 3.5, 3.5),
  rating('card-idfc-first-select', 3.9, 4.0, 5.0, 3.0, 4.0, 3.5),
  rating('card-amex-platinum-travel', 4.2, 4.0, 3.5, 4.5, 4.0, 4.5),
];

/* ----------------------------------------------------- Card change log --- */
/* DESIGN §9 / FRONTEND §11.5 — dated, diffed old→new. One recent, real change. */
export const cardChangeLog: CardChangeLog[] = [
  { id: 'chg-1', card_id: 'card-hdfc-regalia-gold', detected_at: '2026-06-01T00:00:00+00:00',
    change_type: 'benefit_removed', field_name: 'airport_lounge_domestic',
    old_value: '12 complimentary domestic visits per year',
    new_value: '3 visits per quarter, spend-gated (₹60,000 in the preceding quarter)',
    summary: 'Domestic lounge access moved to a spend-based model — ₹60,000 quarterly spend now required for lounge visits (effective July 2026).',
    source_note: 'Issuer communication, effective July 2026' },
  { id: 'chg-2', card_id: 'card-axis-atlas', detected_at: '2026-05-15T00:00:00+00:00',
    change_type: 'eligibility_change', field_name: 'availability',
    old_value: 'Open to new applicants',
    new_value: 'Closed to new applicants (existing cardholders retain benefits)',
    summary: 'The Axis Atlas was discontinued for new applicants in mid-2025; existing cardholders retain all benefits.',
    source_note: 'Issuer notice' },
];

/* -------------------------------------------------------------- Authors --- */
/* Headshots deliberately null — DESIGN §11 / FRONTEND §16: no invented author
   photos. Components render an initials placeholder. */
export const authors: Author[] = [
  { id: 'author-priya', slug: 'priya-menon', name: 'Priya Menon',
    title: 'Cards & Rewards Senior Editor', headshot_url: null,
    bio: 'Priya has spent over a decade covering retail banking and payments in India, translating dense MITC documents and fee schedules into plain-language guidance for first-time and seasoned cardholders alike.',
    expertise_tags: ['Rewards & cashback', 'Fee structures', 'RBI card regulation'],
    highlights: ['Reviewed 300+ Indian credit cards', 'Former personal-finance desk lead at a national daily'],
    is_review_board_member: true },
  { id: 'author-arjun', slug: 'arjun-rao', name: 'Arjun Rao',
    title: 'Points & Miles Expert Contributor', headshot_url: null,
    bio: 'Arjun focuses on travel rewards, airline and hotel transfer partners, and airport-lounge programmes, with a particular interest in getting outsized value from Indian miles currencies.',
    expertise_tags: ['Travel & miles', 'Airport lounges', 'Transfer partners'],
    highlights: ['Tracks every major Indian reward-programme devaluation', 'Redeems 500k+ points/miles a year'],
    is_review_board_member: false },
  { id: 'author-neha', slug: 'neha-shah', name: 'Neha Shah',
    title: 'Editorial Reviewer, Review Board', headshot_url: null,
    bio: 'Neha reviews every card rating for factual accuracy against issuer documentation and ensures our recommendations stay independent of commercial relationships.',
    expertise_tags: ['Fact-checking', 'Compliance', 'Editorial standards'],
    highlights: ['15+ years in financial journalism', 'Chairs our issuer-blind rating review board'],
    is_review_board_member: true },
];
const authorById = Object.fromEntries(authors.map((a) => [a.id, a]));

/* ------------------------------------------------------------- Articles --- */
export const articles: Article[] = [
  {
    id: 'art-regalia-gold', slug: 'hdfc-regalia-gold-review',
    title: 'HDFC Regalia Gold Credit Card Review: Strong Value for Frequent Spenders',
    article_type: 'card_review', author_id: 'author-priya',
    edited_by_author_id: 'author-neha', reviewed_by_author_id: 'author-neha',
    related_card_id: 'card-hdfc-regalia-gold',
    body: [
      '## Why you might want the HDFC Regalia Gold',
      'The Regalia Gold sits in HDFC Bank’s upper-mid tier and rewards concentrated spending well. At 5 Reward Points per ₹200 on general spends — and far more through the SmartBuy and PayZapp portals — it can return meaningful value if you route travel and shopping through the right channels.',
      '## Who should get this card',
      'This card suits salaried professionals and self-employed applicants who comfortably clear ₹4 lakh of annual spend, which is also the threshold at which the ₹2,500 annual fee is waived. If your spending is lower, a lifetime-free card will usually serve you better.',
      '## How to use this card',
      'Concentrate high-value bookings on SmartBuy to hit accelerated earn rates, and track your quarterly spend if airport lounge access matters to you — access is now spend-gated from July 2026.',
      '## Is the HDFC Regalia Gold right for you?',
      'If you spend heavily and value flexible points plus lounge access, the Regalia Gold earns its fee. If not, look at a lifetime-free alternative.',
    ].join('\n\n'),
    meta_description: 'An independent review of the HDFC Regalia Gold Credit Card — rewards, fees, lounge access, eligibility and who it’s right for.',
    og_image_url: '/card-img/036_hdfc_Regalia-Gold-Credit-Card.png',
    published_at: '2026-06-20T00:00:00+00:00', updated_at: '2026-06-28T00:00:00+00:00', is_published: true,
  },
  {
    id: 'art-cibil-guide', slug: 'what-is-a-good-cibil-score',
    title: 'What Is a Good CIBIL Score for a Credit Card in India?',
    article_type: 'guide', author_id: 'author-priya',
    edited_by_author_id: 'author-neha', reviewed_by_author_id: 'author-neha', related_card_id: null,
    body: [
      '## What the CIBIL score bands mean',
      'A CIBIL score of 750 or above is generally considered good to excellent by most Indian card issuers. Scores between 700 and 749 are usually treated as good, 650–699 as fair, and below 650 as an area to improve before applying.',
      '## How your score affects approval',
      'Issuers use your CIBIL score as one input among many — income, existing obligations and employment stability also matter. A strong score widens the range of cards you can realistically be approved for, including premium travel cards.',
      '## How to improve your CIBIL score',
      'Pay in full and on time, keep your credit utilisation low, and avoid applying for many cards in a short window, since each application triggers a hard inquiry.',
    ].join('\n\n'),
    meta_description: 'Understand CIBIL score bands and how they affect Indian credit-card approval, with practical steps to improve your score.',
    og_image_url: null,
    published_at: '2026-05-10T00:00:00+00:00', updated_at: '2026-06-15T00:00:00+00:00', is_published: true,
  },
  {
    id: 'art-rbi-network-choice', slug: 'rbi-card-network-choice-2026',
    title: 'RBI’s 2026 Card-Network Choice Rules: What They Mean for You',
    article_type: 'news', author_id: 'author-arjun',
    edited_by_author_id: 'author-priya', reviewed_by_author_id: 'author-neha', related_card_id: null,
    body: [
      '## What changed',
      'Under the Reserve Bank of India’s network-choice reforms, larger issuers must now offer customers a choice of card network (Visa, Mastercard, RuPay, and others) at issuance or renewal rather than defaulting you onto a single network.',
      '## Why it matters',
      'Different networks carry different acceptance footprints and benefit programmes. Being able to choose lets you optimise for international acceptance, RuPay-on-UPI functionality, or specific network perks.',
      '## What to do',
      'When applying or renewing, ask which networks a card is available on and pick the one whose acceptance and benefits fit how you actually spend.',
    ].join('\n\n'),
    meta_description: 'RBI’s 2026 rules let you choose your credit-card network at issuance or renewal. Here’s what that means for Indian cardholders.',
    og_image_url: null,
    published_at: '2026-06-25T00:00:00+00:00', updated_at: '2026-06-25T00:00:00+00:00', is_published: true,
  },
];

/* ---------------------------------------------------- point_valuations --- */
/* BACKEND §4.5 — assumed ₹-per-point, marked as estimates. */
export const pointValuations: PointValuation[] = [
  { id: 'pv-hdfc', bank_id: 'bank-hdfc', program_name: 'HDFC Reward Points', reward_type: 'points',
    redemption_channel: 'voucher', estimated_inr_per_point_min: 0.2, estimated_inr_per_point_typical: 0.3,
    estimated_inr_per_point_max: 0.5, notes: 'Higher via SmartBuy flight/hotel bookings.', last_reviewed_at: '2026-06-01' },
  { id: 'pv-axis-miles', bank_id: 'bank-axis', program_name: 'Axis EDGE Miles', reward_type: 'miles',
    redemption_channel: 'flight_transfer', estimated_inr_per_point_min: 0.8, estimated_inr_per_point_typical: 1.0,
    estimated_inr_per_point_max: 1.2, notes: 'Best value via partner airline transfers.', last_reviewed_at: '2026-06-01' },
  { id: 'pv-amex-mr', bank_id: 'bank-amex', program_name: 'Amex Membership Rewards', reward_type: 'points',
    redemption_channel: 'voucher', estimated_inr_per_point_min: 0.4, estimated_inr_per_point_typical: 0.5,
    estimated_inr_per_point_max: 1.0, notes: 'Milestone-driven; value depends on redemption.', last_reviewed_at: '2026-06-01' },
];

/* ----------------------------------------------------- Derived helpers --- */
export function listingRowFor(card: SeedCard): CardListingRow {
  const bank = bankById[card.bank_id];
  const rating = cardRatings.find((r) => r.card_id === card.id);
  return {
    card_id: card.id, card_slug: card.slug, card_name: card.name,
    bank_slug: bank.slug, bank_name: bank.name, image_url: card.image_url,
    primary_category_slug: card.primary_category_slug,
    annual_fee_amount: card.annual_fee_amount, cibil_min: card.cibil_min,
    overall_score: rating?.overall_score ?? null,
    headline_reward_line: card.headline_reward_line, reward_type: card.reward_type,
    data_confidence: card.data_confidence,
  };
}

export const seed = {
  banks, bankById, bankBySlug, categories, cards, cardById, cardBySlug,
  cardRewardCategories, cardBonuses, cardFees, cardEligibility, cardRatings,
  cardChangeLog, authors, authorById, articles, pointValuations, listingRowFor,
};
export type { SeedCard };
