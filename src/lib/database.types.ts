/*
 * Hand-authored schema contract matching BACKEND_PROMPT.md §4. This is the
 * agreed interface between the Astro frontend and the Supabase backend built in
 * supabase/migrations/. When the real DB exists, this can be replaced by
 * `supabase gen types typescript` output — but the shapes must stay compatible.
 * Frontend queries and Edge Function I/O both import from here.
 */
import type {
  SpendCategoryKey, RewardType, DataConfidence, CardNetwork,
  Goal, MonthlySpendBand, AirTravelFrequency, EmploymentType,
  AnnualIncomeBand, CibilBand, FeePreference,
} from './taxonomy';

/* ---- §4.1 Catalog ---- */
export interface Bank {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  official_website: string | null;
  about: string | null;
  is_scheduled_commercial_bank: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_order: number;
}

export interface Card {
  id: string;
  bank_id: string;
  slug: string;
  name: string;
  image_url: string | null;
  card_type: 'credit' | 'debit';
  network: CardNetwork | null;
  network_is_estimated: boolean;
  tier: string | null;
  official_url: string | null;
  last_verified_at: string | null;
  joining_fee_amount: number | null;
  joining_fee_raw: string | null;
  annual_fee_amount: number | null;
  annual_fee_raw: string | null;
  annual_fee_waiver_spend_amount: number | null;
  annual_fee_waiver_spend_raw: string | null;
  forex_markup_pct: number | null;
  reward_type: RewardType | null;
  reward_rate_general_text: string | null;
  base_reward_value_inr_per_100: number | null;
  fuel_surcharge_waiver_text: string | null;
  fuel_surcharge_waiver_pct: number | null;
  lounge_domestic_visits_per_year: number | null;
  lounge_domestic_text: string | null;
  lounge_intl_visits_per_year: number | null;
  lounge_intl_network: string | null;
  lounge_intl_text: string | null;
  supports_contactless: boolean | null;
  supports_upi: boolean | null;
  age_min: number | null;
  age_max: number | null;
  cibil_min: number | null;
  cibil_min_is_estimated: boolean;
  editorial_score_raw: string | null;
  editorial_score_5: number | null;
  data_confidence: DataConfidence;
  raw_source: Record<string, unknown>;
  estimated_fields: string[];
  is_active: boolean;
}

export interface CardRewardCategory {
  card_id: string;
  category_key: SpendCategoryKey;
  multiplier: number | null;
  rate_pct: number | null;
  cap_amount: number | null;
  cap_period: 'monthly' | 'billing_cycle' | 'yearly' | null;
  raw_text: string | null;
  parsed_by_llm: boolean;
  needs_review: boolean;
}

export interface CardBonus {
  card_id: string;
  bonus_type: 'welcome' | 'milestone' | 'anniversary' | 'other';
  description: string | null;
  threshold_spend_amount: number | null;
  threshold_period: string | null;
  estimated_value_inr: number | null;
  is_estimated: boolean;
  valid_until: string | null;
  parsed_by_llm: boolean;
  needs_review: boolean;
}

export interface CardFee {
  card_id: string;
  fee_type:
    | 'joining' | 'annual' | 'renewal' | 'cash_advance' | 'late_payment'
    | 'over_limit' | 'forex_markup' | 'add_on_card' | 'reward_redemption' | 'other';
  amount: number | null;
  is_percentage: boolean;
  min_amount: number | null;
  max_amount: number | null;
  raw_text: string | null;
}

export interface CardEligibility {
  card_id: string;
  employment_type: 'salaried' | 'self_employed' | 'student' | 'any';
  min_income_amount: number | null;
  min_income_period: 'monthly' | 'annual' | null;
  raw_text: string | null;
}

export interface CardRating {
  card_id: string;
  overall_score: number | null;
  rewards_value_score: number | null;
  fees_charges_score: number | null;
  welcome_benefit_score: number | null;
  flexibility_score: number | null;
  issuer_service_score: number | null;
  methodology_note: string | null;
  rated_by: string | null;
  rated_at: string | null;
}

export interface CardChangeLog {
  id: string;
  card_id: string;
  detected_at: string;
  change_type:
    | 'fee_increase' | 'fee_decrease' | 'reward_devaluation' | 'reward_improvement'
    | 'benefit_added' | 'benefit_removed' | 'eligibility_change' | 'other';
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  summary: string;
  source_note: string | null;
}

/* ---- §4.2 Editorial ---- */
export interface Author {
  id: string;
  slug: string;
  name: string;
  title: string | null;
  headshot_url: string | null;
  bio: string | null;
  expertise_tags: string[];
  highlights: string[];
  is_review_board_member: boolean;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  article_type: 'card_review' | 'category_roundup' | 'guide' | 'news';
  author_id: string | null;
  edited_by_author_id: string | null;
  reviewed_by_author_id: string | null;
  related_card_id: string | null;
  body: string;
  meta_description: string | null;
  og_image_url: string | null;
  published_at: string | null;
  updated_at: string | null;
  is_published: boolean;
}

/* ---- §4.3 User / wallet ---- */
export interface UserWalletCard {
  id: string;
  user_id: string;
  card_id: string;
  card_opened_date: string | null;
  billing_cycle_day: number | null;
  current_cycle_spend: number;
  last_spend_update: string | null;
  notes: string | null;
}

export interface WalletSpendLog {
  id: string;
  wallet_card_id: string;
  amount: number;
  logged_at: string;
  note: string | null;
}

/* ---- §4.5 Reference ---- */
export interface PointValuation {
  id: string;
  bank_id: string | null;
  program_name: string;
  reward_type: string;
  redemption_channel: 'flight_transfer' | 'voucher' | 'statement_credit' | 'other';
  estimated_inr_per_point_min: number | null;
  estimated_inr_per_point_typical: number | null;
  estimated_inr_per_point_max: number | null;
  notes: string | null;
  last_reviewed_at: string | null;
}

/* ---- §4.6 Views ---- */
export interface CardListingRow {
  card_id: string;
  card_slug: string;
  card_name: string;
  bank_slug: string;
  bank_name: string;
  image_url: string | null;
  primary_category_slug: string | null;
  annual_fee_amount: number | null;
  cibil_min: number | null;
  overall_score: number | null;
  headline_reward_line: string | null;
  reward_type: RewardType | null;
  data_confidence: DataConfidence;
}

/* ---- §9 Edge Function I/O contracts ---- */
export interface RecommendInput {
  goal: Goal;
  monthly_spend_band: MonthlySpendBand;
  top_categories: SpendCategoryKey[];
  air_travel_frequency: AirTravelFrequency;
  employment_type: EmploymentType;
  annual_income_band: AnnualIncomeBand;
  cibil_band: CibilBand;
  fee_preference: FeePreference;
}

export interface RecommendResult {
  card_id: string;
  card_slug: string;
  card_name: string;
  total_score: number;
  subscores: {
    category_match: number;
    net_value: number;
    travel_fit: number;
    fee_pref: number;
    editorial_prior: number;
  };
  reasons: string[];
  estimated_annual_value_inr: number;
  fee_waiver_note: string | null;
}

export interface ComboInput {
  category_spend: Partial<Record<SpendCategoryKey, number>>;
  max_cards: 2 | 3;
  eligibility: {
    employment_type: EmploymentType;
    annual_income_band: AnnualIncomeBand;
    cibil_band: CibilBand;
  };
  max_total_annual_fee?: number;
}

export interface ComboResult {
  cards: { card_id: string; card_name: string }[];
  per_category_assignment: Partial<Record<SpendCategoryKey, string>>;
  total_annual_reward_value_inr: number;
  total_annual_fees_inr: number;
  net_value_inr: number;
  warnings: string[];
}

export interface BestCardInput {
  category_key: SpendCategoryKey;
  amount_inr: number;
  card_ids?: string[];
}

export interface BestCardResult {
  card_id: string;
  card_name?: string;
  estimated_value_inr: number;
  redemption_note: string;
  milestone_nudge: string | null;
}

export interface SearchResult {
  result_type: 'card' | 'article';
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  rank: number;
}
