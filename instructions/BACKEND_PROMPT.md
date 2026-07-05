# BACKEND_PROMPT.md — CardCompare.in Backend Build (Supabase)

> Paste this entire file as your task prompt in Claude Code / Antigravity CLI. Keep it in the repo root alongside `DESIGN.md` and `FRONTEND_PROMPT.md` — re-reference all three at the start of every new agent session so schema and contracts stay in sync across sessions and across the two CLIs you're switching between.

---

## 0. Role

You are a senior backend engineer building the data layer, API surface, and business logic for **CardCompare.in** on **Supabase** (Postgres + Auth + Storage + Edge Functions + pg_cron). The frontend is a separate Astro build (see `FRONTEND_PROMPT.md`) that consumes exactly the tables, views, and Edge Function contracts defined here. Nothing in this document is optional scaffolding — the recommendation engine, combo optimizer, and card-change tracker all depend on the schema being right from the start, since retrofitting fields into 270+ already-imported card records is far more expensive than modeling them correctly now.

## 1. Source data

You'll be given a JSON array of ~270+ Indian credit card records across ~20 banks, one object per card, in this shape:

```json
{
  "bank_name": "HDFC Bank",
  "card_name": "All Miles Credit Card",
  "card_img": "card-img/001_hdfc_All-Miles-Credit-Card.png",
  "card_type": "credit",
  "card_network": "Visa (est)",
  "variant/tier": "Premium Travel / Signature equivalent (est)",
  "card_category": "rewards",
  "official_url": "https://www.hdfcbank.com/credit-cards/all-miles-credit-card",
  "last_verified_at": "2026-06-07T00:00:00+00:00",
  "joining_fee": "Rs. 2500",
  "annual_fee": "Rs. 2500",
  "annual_fee_waiver_spend": "Rs. 3,00,000",
  "forex_markup": "3.5%",
  "Reward_type (points/cashback/miles)": "points",
  "reward_rate_general": "3X Reward Points for every ₹150 spent",
  "reward_rate_category_wise": "Air India & Vistara tickets: 3X Reward Points; hotel bookings, mobile recharge and shopping: 2X Reward Points",
  "all_bonus": "Welcome bonus miles/points (est), Milestone bonus on achieving spending thresholds (est)",
  "fuel_surcharge_waiver": "1% Fuel Surcharge waived off on fuel transactions",
  "airport_lounge_domestic": "4 complimentary visits per calendar year (est)",
  "airport_lounge_international": "4 complimentary visits per calendar year via Priority Pass (est)",
  "all_offers [highlights]": "Accelerated reward points on travel bookings (est), discounts on airline/hotel bookings (est)",
  "contactless/UPI/support": "yes",
  "minimum_income": "Salaried: ₹60,000 - ₹1,00,000 per month (est), Self-employed: ₹7.5 - ₹12 Lakhs ITR per annum (est)",
  "employment_type": "Salaried, Self-employed (est)",
  "age_min & age_max": "21 - 65 years",
  "cibil_min": "750+ (est)",
  "card_score": "7.5/10"
}
```

This is semi-structured: some fields are clean values, several are free-text prose with inconsistent phrasing across banks, and individual facts within a field are sometimes suffixed `(est)` to mark them as estimated rather than sourced from the issuer's own MITC/fee documentation. Your schema and import pipeline must preserve that distinction — a recommendation engine and combo optimizer that treat estimated and verified figures identically will silently produce financial "recommendations" that read as more confident than the underlying data actually is. Don't collapse that signal away during import.

## 2. Important disambiguation: two different "category" concepts

Don't conflate these — they use similar words but are unrelated taxonomies with different tables:

- **Content/nav category** (`categories` table, §3): the site's navigation taxonomy — Cashback, Travel, Rewards, Fuel, Lifetime Free, Business, Low Interest, Student, Super Premium, Airport Lounge. This is what `/best/[category-slug]` pages are built from, sourced loosely from the input data's `card_category` field plus editorial judgment (a card can belong to more than one).
- **Spend category** (`category_key` values used in `card_reward_categories`, the recommendation quiz, and the combo optimizer, §9): a fixed taxonomy describing *where a user spends money*, used for reward-rate math. Canonical list, use exactly these keys everywhere they appear across both this document and the frontend:

```
general, groceries, online_shopping, dining, travel_flights, travel_hotels,
fuel, utility_bills, emi_large_purchases, entertainment, other
```

## 3. Tech stack decisions

- Postgres via Supabase, all schema changes as versioned files under `supabase/migrations/`.
- Row Level Security **on by default on every table** — write the policy in the same migration that creates the table, never ship a table with RLS off "temporarily."
- Edge Functions in TypeScript/Deno (`supabase/functions/*`).
- Auth: Supabase Auth, email + mobile OTP (see §10).
- Storage: Supabase Storage buckets for card art and author headshots (see §11).
- Scheduled jobs: `pg_cron` triggering Edge Functions, or Supabase's native Cron Triggers on Edge Functions — either is fine, pick one and be consistent.
- Transactional email: Resend (good India deliverability, simple API) for fee-waiver reminders and change-alert emails — swap freely if the person has another preference, it's an implementation detail behind a single thin wrapper.

## 4. Full schema

Types below are intent, not exact DDL — write real migrations from this, add `created_at`/`updated_at timestamptz default now()` to every table even where not listed, and use `uuid primary key default gen_random_uuid()` unless noted otherwise.

### 4.1 Catalog tables (public read, service-role write only)

**`banks`**
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| slug | text unique | e.g. `hdfc-bank` |
| name | text | |
| logo_url | text | storage path |
| official_website | text | |
| about | text | |
| is_scheduled_commercial_bank | boolean default true | powers the RBI-regulated trust line, `DESIGN.md` §10.4 |

**`categories`** (content/nav taxonomy)
| column | type |
|---|---|
| id | uuid pk |
| slug | text unique |
| name | text |
| description | text |
| display_order | int |

**`cards`** — the core table
| column | type | source field | notes |
|---|---|---|---|
| id | uuid pk | | |
| bank_id | uuid fk → banks | `bank_name` | |
| slug | text unique | derived | e.g. `hdfc-bank-all-miles-credit-card` |
| name | text | `card_name` | |
| image_url | text | `card_img` | storage path, preserve source relative path structure |
| card_type | text check in ('credit','debit') | `card_type` | |
| network | text check in ('visa','mastercard','rupay','amex','diners') | `card_network` | strip `(est)` suffix into `network_is_estimated` |
| network_is_estimated | boolean | | |
| tier | text | `variant/tier` | |
| official_url | text | `official_url` | |
| last_verified_at | timestamptz | `last_verified_at` | |
| joining_fee_amount | numeric | `joining_fee` | parsed |
| joining_fee_raw | text | `joining_fee` | original string, always keep |
| annual_fee_amount | numeric | `annual_fee` | parsed |
| annual_fee_raw | text | `annual_fee` | |
| annual_fee_waiver_spend_amount | numeric | `annual_fee_waiver_spend` | parsed |
| annual_fee_waiver_spend_raw | text | `annual_fee_waiver_spend` | |
| forex_markup_pct | numeric | `forex_markup` | |
| reward_type | text check in ('points','cashback','miles','hybrid') | `Reward_type (points/cashback/miles)` | |
| reward_rate_general_text | text | `reward_rate_general` | raw, always keep for display |
| base_reward_value_inr_per_100 | numeric | derived | normalized ₹-value-per-₹100-spent estimate at the *general* rate — computed during the LLM enrichment pass, §7.2, used by scoring algorithms |
| fuel_surcharge_waiver_text | text | `fuel_surcharge_waiver` | |
| fuel_surcharge_waiver_pct | numeric | parsed | |
| lounge_domestic_visits_per_year | int | `airport_lounge_domestic` | parsed |
| lounge_domestic_text | text | `airport_lounge_domestic` | raw |
| lounge_intl_visits_per_year | int | `airport_lounge_international` | parsed |
| lounge_intl_network | text | `airport_lounge_international` | e.g. "Priority Pass" |
| lounge_intl_text | text | `airport_lounge_international` | raw |
| supports_contactless | boolean | `contactless/UPI/support` | |
| supports_upi | boolean | `contactless/UPI/support` | |
| age_min | int | `age_min & age_max` | |
| age_max | int | `age_min & age_max` | |
| cibil_min | int | `cibil_min` | strip `+`/`(est)` |
| cibil_min_is_estimated | boolean | `cibil_min` | |
| editorial_score_raw | text | `card_score` | e.g. "7.5/10" |
| editorial_score_5 | numeric(2,1) | derived | normalized to a 0–5 scale to match `DESIGN.md`'s rating widget (`raw numerator / raw denominator * 5`) |
| data_confidence | text check in ('verified','partially_estimated','estimated') | derived | see §7.1 |
| raw_source | jsonb | full record | keep the entire original scraped object verbatim, always — this is your fallback/audit trail when structured parsing is wrong |
| estimated_fields | text[] | derived | list of field names that carried an `(est)` marker in the source |
| is_active | boolean default true | | flip false, don't delete, when a card is discontinued |

**`card_categories`** (junction, content taxonomy)
`card_id`, `category_id`, `is_primary boolean`

**`card_reward_categories`** (spend-category reward rates — powers the recommendation engine, combo optimizer, and best-card calculator)
| column | type | notes |
|---|---|---|
| card_id | uuid fk | |
| category_key | text | one of the canonical spend-category keys, §2 |
| multiplier | numeric | e.g. `3` for "3X" |
| rate_pct | numeric | for cashback-style cards, e.g. `5` for 5% |
| cap_amount | numeric | nullable |
| cap_period | text | 'monthly'/'billing_cycle'/'yearly', nullable |
| raw_text | text | the source phrase this row was extracted from |
| parsed_by_llm | boolean | see §7.2 |
| needs_review | boolean default true | flip false once an editor has spot-checked it |

**`card_bonuses`**
`card_id`, `bonus_type` check in ('welcome','milestone','anniversary','other'), `description text`, `threshold_spend_amount numeric`, `threshold_period text`, `estimated_value_inr numeric`, `is_estimated boolean`, `valid_until date`, `parsed_by_llm boolean`, `needs_review boolean default true`

**`card_offers`**
`card_id`, `offer_text text`, `category text`, `valid_until date`, `is_estimated boolean`, `parsed_by_llm boolean`, `needs_review boolean default true`

**`card_fees`** (fee schedule breakdown, beyond joining/annual)
`card_id`, `fee_type` check in ('joining','annual','renewal','cash_advance','late_payment','over_limit','forex_markup','add_on_card','reward_redemption','other'), `amount numeric`, `is_percentage boolean`, `min_amount numeric`, `max_amount numeric`, `raw_text text`

**`card_eligibility`**
`card_id`, `employment_type` check in ('salaried','self_employed','student','any'), `min_income_amount numeric`, `min_income_period` check in ('monthly','annual'), `raw_text text`

**`card_ratings`** (editorial — populated by the editorial workflow, never by the import script)
`card_id` pk, `overall_score numeric(2,1)`, `rewards_value_score numeric(2,1)`, `fees_charges_score numeric(2,1)`, `welcome_benefit_score numeric(2,1)`, `flexibility_score numeric(2,1)`, `issuer_service_score numeric(2,1)`, `methodology_note text`, `rated_by uuid fk → authors`, `rated_at timestamptz`

**`card_snapshots`** (internal only — never exposed to anon/authenticated roles)
`card_id`, `snapshot jsonb`, `snapshotted_at timestamptz default now()` — one row written per card on every import run; source of truth for change detection, §9.4.

**`card_change_log`**
`card_id`, `detected_at timestamptz default now()`, `change_type` check in ('fee_increase','fee_decrease','reward_devaluation','reward_improvement','benefit_added','benefit_removed','eligibility_change','other'), `field_name text`, `old_value text`, `new_value text`, `summary text` (human-readable, e.g. "Annual fee increased from ₹500 to ₹750"), `source_note text`

### 4.2 Editorial tables

**`authors`**: `slug`, `name`, `title`, `headshot_url`, `bio text`, `expertise_tags text[]`, `highlights text[]`, `is_review_board_member boolean`

**`articles`**: `slug unique`, `title`, `article_type` check in ('card_review','category_roundup','guide','news'), `author_id fk`, `edited_by_author_id fk`, `reviewed_by_author_id fk`, `related_card_id fk → cards` (nullable), `body text` (Markdown/MDX), `meta_description text`, `og_image_url text`, `published_at timestamptz`, `updated_at timestamptz`, `is_published boolean default false`

### 4.3 User / wallet tables

**`profiles`**: `id uuid pk references auth.users`, `full_name text`, `mobile_number text`, `email text`

**`user_wallet_cards`**: `id`, `user_id fk → profiles`, `card_id fk → cards`, `card_opened_date date`, `billing_cycle_day int` (1–31), `current_cycle_spend numeric default 0`, `last_spend_update timestamptz`, `notes text`

**`wallet_spend_log`**: `id`, `wallet_card_id fk`, `amount numeric`, `logged_at timestamptz default now()`, `note text`

**`recommendation_sessions`** (analytics, optional but recommended — lets you actually measure whether the recommendation engine is any good): `id`, `user_id fk` nullable, `answers jsonb`, `results jsonb`, `created_at`

**`combo_optimizer_sessions`**: same shape as above, for the combo optimizer

### 4.4 Growth / ops tables

**`newsletter_subscribers`**: `id`, `email unique not null`, `subscribed_at`, `confirmed boolean default false`, `source text`

**`card_click_events`** (affiliate attribution — this is the monetization measurement layer, don't skip it): `id`, `card_id fk`, `anon_session_id text`, `user_id fk` nullable, `clicked_at`, `destination_url text`, `referrer_page text`

**`reminders_sent`**: `id`, `user_id fk`, `wallet_card_id fk`, `reminder_type text`, `sent_at` — dedupe guard for §9.5

### 4.5 Reference tables

**`point_valuations`** (assumed ₹-per-point conversion, used by the best-card calculator and the recommendation engine's value math): `id`, `bank_id fk` nullable, `program_name text`, `reward_type text`, `redemption_channel text` check in ('flight_transfer','voucher','statement_credit','other'), `estimated_inr_per_point_min numeric`, `estimated_inr_per_point_typical numeric`, `estimated_inr_per_point_max numeric`, `notes text`, `last_reviewed_at date` — **populate this manually/editorially before the recommendation engine or best-card calculator go live**; without it, every ₹-value estimate the site shows is fabricated precision on top of a guess. This is the single highest-leverage editorial data-entry task in the whole build — roughly 20–30 rows (one per major bank reward program) covers the great majority of the catalog.

### 4.6 Postgres views (build these, frontend queries them directly, not raw joins)

- `card_listing_view`: flattens `cards` + `banks` + best-primary-category + `card_ratings.overall_score` + a computed "headline reward line" — this is what powers `/best/[category]` filter/sort. Index on `annual_fee_amount`, `cibil_min`, `overall_score`.
- `wallet_summary_view`: per-user aggregation (total annual fees, total lounge visits, upcoming renewals) for the `/wallet` dashboard, RLS-scoped.

## 5. Row Level Security policy summary

| Table group | anon | authenticated | service_role |
|---|---|---|---|
| `banks`, `categories`, `cards`, `card_categories`, `card_reward_categories`, `card_bonuses`, `card_offers`, `card_fees`, `card_eligibility`, `card_ratings`, `card_change_log`, `authors`, `point_valuations`, `articles` (where `is_published = true`) | **select** | select | select/insert/update/delete |
| `card_snapshots` | none | none | full — internal only |
| `profiles`, `user_wallet_cards`, `wallet_spend_log` | none | select/insert/update/delete **where `user_id = auth.uid()`** | full |
| `recommendation_sessions`, `combo_optimizer_sessions` | insert (anon allowed, `user_id null`) | insert + select own | full |
| `newsletter_subscribers` | insert only | insert only | full (no client select — protect subscriber emails) |
| `card_click_events` | insert only | insert only | full |
| `reminders_sent` | none | select own | full |

Write every one of these as an explicit policy in the migration that creates the table. Don't rely on "no policy = no access" being obvious to a future editor of this schema — be explicit.

## 6. Category taxonomy seed data

Seed `categories` with at minimum: Cashback, Travel, Rewards, Fuel, Lifetime Free, Business, Low Interest, Student, Super Premium, Airport Lounge, Dining, Shopping. Do **not** seed a "0% APR" category — per `DESIGN.md` §10.9, that US category doesn't map to Indian card marketing; "Low Interest" is the correct equivalent.

## 7. Data import pipeline

Build `scripts/import-cards.ts` (or `.py` — pick one, Node/TS is a reasonable default since it can share types with the Edge Functions), rerunnable and idempotent.

### 7.1 Structured parsing pass

For each source record:
1. Upsert `banks` by name → slug (create if missing).
2. Parse money strings (`"Rs. 2500"`, `"₹3,00,000"`) → strip everything but digits/decimal point → numeric; always also store the original string in the matching `_raw` column.
3. Parse percentages (`"3.5%"`) → numeric.
4. Parse ranges (`"21 - 65 years"`) → split on `-`, trim, `parseInt` → `age_min`/`age_max`.
5. Parse `"7.5/10"` → `editorial_score_raw` kept as-is, `editorial_score_5 = numerator / denominator * 5`.
6. Detect and strip `(est)` markers: for every field where the source value contains `(est)`, strip it from the stored clean value and append that field's canonical name to `cards.estimated_fields`. Set `data_confidence`: `'verified'` if `estimated_fields` is empty, `'estimated'` if most/all populated fields carry the marker, else `'partially_estimated'`.
7. Upsert `cards` on a natural unique key (`bank_id` + `slug` derived from `card_name`) so reruns update existing rows rather than duplicating.
8. On every run, after upserting a card, insert a fresh row into `card_snapshots` with the full parsed record — this is what change detection (§9.4) diffs against.
9. Upload the image at the source's `card_img` relative path into the `card-images` storage bucket, preserving that path structure; store the resulting path in `cards.image_url`.
10. At the end of the run (not per-row), trigger exactly one frontend rebuild via the deploy-hook webhook (see `FRONTEND_PROMPT.md` §5).

### 7.2 LLM-assisted enrichment pass (separate script, run after 7.1)

Several source fields are free-text prose that varies in phrasing across 20 different banks and won't parse reliably with regex: `reward_rate_category_wise`, `all_bonus`, `all_offers [highlights]`. Rather than writing brittle per-bank regex, use Claude itself (you already have Opus access in this workflow) to do structured extraction:

For each card, send its raw `reward_rate_category_wise` / `all_bonus` / `all_offers` text to the Claude API with a strict system prompt that requires JSON-only output matching the target row shape (category_key/multiplier/rate_pct/cap for reward categories; bonus_type/description/threshold for bonuses; offer_text/category for offers — reuse the canonical `category_key` list from §2 as an enum constraint in the prompt so the model can't invent new category names). Parse the response, insert rows into `card_reward_categories` / `card_bonuses` / `card_offers` with `parsed_by_llm = true` and `needs_review = true`.

This is genuinely load-bearing data — the recommendation engine and combo optimizer's scoring math both read directly from `card_reward_categories`. Build a simple admin review view/query (`select * from card_reward_categories where needs_review = true order by card_id`) and have a human spot-check a meaningful sample — at minimum every row feeding into `base_reward_value_inr_per_100` on `cards` — before flipping the recommendation engine live on this data. Also compute `cards.base_reward_value_inr_per_100` during this pass: from `reward_rate_general_text` + the card's `reward_type` + the matching `point_valuations` row, derive one normalized ₹-per-₹100-spent figure at the general rate.

### 7.3 Post-import validation report

Run a query after each import that flags cards missing critical fields: no `annual_fee_amount`, no `cibil_min`, zero `card_reward_categories` rows, no `card_eligibility` row. Surface this as a simple report (console output or a `data_quality_flags` view) — don't let the recommendation engine silently treat "missing income requirement" as "no income requirement."

## 8. Search implementation

Add a generated `tsvector` column to `cards` (over `name`, bank name via join, `tier`, `reward_rate_general_text`) and to `articles` (over `title`, `body`), each with a GIN index. Expose a single Postgres function `search_site(query text)` returning a unioned, ranked result set across both, called via `supabase.rpc('search_site', { query })` from the frontend's `/search` route.

## 9. Edge Functions

### 9.1 `recommend-cards` (POST)

**Input:**
```json
{
  "goal": "cashback|travel_miles|rewards_points|fuel_savings|first_card|business|lounge_access",
  "monthly_spend_band": "lt20k|20k_50k|50k_1l|1l_3l|3l_plus",
  "top_categories": ["groceries", "dining"],
  "air_travel_frequency": "never|1_2_year|3_6_year|7_plus_year",
  "employment_type": "salaried|self_employed|student|not_employed",
  "annual_income_band": "lt3l|3_6l|6_12l|12_25l|25l_plus",
  "cibil_band": "750_plus|700_749|650_699|new_to_credit|not_sure",
  "fee_preference": "lifetime_free_only|value_over_3x|no_preference"
}
```

**Algorithm:**

1. **Hard filter** the eligible card pool: `is_active = true`; `card_eligibility.employment_type` matches the user's declared type or is `'any'`; the user's income band's floor value clears `card_eligibility.min_income_amount` (normalize `min_income_period` to annual for comparison); if `cibil_band != 'not_sure'`, exclude cards where `cards.cibil_min` exceeds the band's floor — if `cibil_band == 'not_sure'`, don't hard-filter on CIBIL, instead down-weight cards with `cibil_min > 750` in scoring (step 2e).
2. **Score** each surviving card 0–100:
   - a. `category_match_score` (0–35): look up `card_reward_categories` rows matching the user's `top_categories`; convert each candidate's best-matching multiplier/rate into ₹-value using `point_valuations`; scale 0–35 relative to the max value found in the filtered pool.
   - b. `net_value_score` (0–30): estimated annual reward value = `monthly_spend_band` midpoint × 12 × blended rate (weighted average of general rate and matched category rate) minus `annual_fee_amount` (zero the fee term if the estimated annual spend clears `annual_fee_waiver_spend_amount`); scale 0–30 relative to the filtered pool's range.
   - c. `travel_fit_score` (0–15): only contributes if `goal` is `travel_miles`/`lounge_access` or `air_travel_frequency != 'never'`; based on `lounge_domestic_visits_per_year` + `lounge_intl_visits_per_year` and inversely on `forex_markup_pct`.
   - d. `fee_pref_score` (0–10): full marks if `fee_preference == 'lifetime_free_only'` and `annual_fee_amount == 0`; partial credit if the waiver is realistically achievable at the declared spend band; full marks by default if `fee_preference == 'no_preference'`.
   - e. `editorial_prior_score` (0–10): `card_ratings.overall_score / 5 * 10` if populated, else a neutral `5` — and apply the CIBIL-uncertainty down-weight from step 1 here (multiply by ~0.7) if `cibil_band == 'not_sure'` and `cards.cibil_min > 750`.
3. **Assemble the result set:** top 3 by total score, plus one "stretch pick" (highest `editorial_score_5` among eligible cards excluded from the top 3 only by being above the user's spend comfort level), plus one guaranteed lifetime-free fallback if none of the above already has `annual_fee_amount == 0`.
4. **Generate `reasons`:** 2–3 short plain-language strings per result, derived from whichever subscores contributed most — not a raw number dump. E.g. `"Matches your grocery spend with 5X points, worth an estimated ₹4,200/year"`, `"₹2,500 fee is waived once you cross ₹3L/year — right in line with your spend band"`.

**Output:**
```json
[{
  "card_id": "...", "card_slug": "...", "card_name": "...",
  "total_score": 84,
  "subscores": { "category_match": 31, "net_value": 26, "travel_fit": 9, "fee_pref": 8, "editorial_prior": 10 },
  "reasons": ["...", "..."],
  "estimated_annual_value_inr": 4200,
  "fee_waiver_note": "Waived if you spend ₹3,00,000+ this year"
}]
```

Log every call (best-effort, don't block the response on it) into `recommendation_sessions`.

### 9.2 `optimize-combo` (POST)

**Input:**
```json
{
  "category_spend": { "groceries": 15000, "dining": 8000, "travel_flights": 20000, "fuel": 5000, "utility_bills": 4000, "online_shopping": 10000, "other": 10000 },
  "max_cards": 2,
  "eligibility": { "employment_type": "salaried", "annual_income_band": "6_12l", "cibil_band": "700_749" }
}
```
(monthly ₹ figures; `eligibility` reuses the same shape as §9.1 inputs)

**Algorithm — a greedy marginal-value heuristic, explicitly not an exhaustive combinatorial search** (270 cards choose 3 is far too large to brute-force per request):

1. Apply the same hard eligibility filter as §9.1.
2. For each eligible card, compute its per-spend-category effective rate from `card_reward_categories` (falling back to `base_reward_value_inr_per_100` for uncovered categories).
3. Pre-rank by a quick single-card annual net value (Σ over categories of `spend × rate`, minus the card's own annual fee) and keep the top ~40 candidates — this bounds the search to something that runs in well under a second.
4. **Greedy construction:** pick card #1 = highest single-card net value from the top-40. For each remaining slot up to `max_cards`, compute every remaining candidate's *marginal* value = Σ over categories of `max(0, candidate_rate − current_best_rate_for_that_category) × category_spend`, minus that candidate's own annual fee (netted against its own waiver threshold using only the spend it would actually capture at this step). Pick the candidate with the highest marginal value. **Stop adding cards early** if the best available marginal value is ≤ 0 — don't force a combo up to `max_cards` if the extra card isn't worth its fee.
5. **Final assignment pass:** once the combo is fixed, assign each spend category's *full* amount to whichever card in the final combo has the best rate for it (winner-take-all per category — this matches how a real user would actually use the cards).
6. Recompute totals from the final assignment: `total_annual_reward_value_inr`, `total_annual_fees_inr` (fee waived per card only if its *assigned* spend clears that card's own waiver threshold), `net_value_inr`.
7. **Redundancy check:** if 2+ cards in the combo both have non-zero lounge visits, or both belong to the same content category with clearly overlapping benefit type, add a warning string.
8. Return the primary combo plus one alternate (e.g. the best combo constrained to `max_cards - 1`, or an all-lifetime-free variant) so the user has a comparison point.

**Output:**
```json
[{
  "cards": [{"card_id": "...", "card_name": "..."}],
  "per_category_assignment": { "groceries": "card_id_a", "dining": "card_id_a", "travel_flights": "card_id_b", ... },
  "total_annual_reward_value_inr": 38500,
  "total_annual_fees_inr": 2500,
  "net_value_inr": 36000,
  "warnings": ["Both cards offer overlapping airport lounge access — consider dropping one"]
}]
```

### 9.3 `best-card-for-purchase` (POST)

**Input:** `{ "category_key": "dining", "amount_inr": 3000, "card_ids": ["...", "..."] }` — `card_ids` optional; if omitted and the request is authenticated, default to the caller's `user_wallet_cards`.

**Algorithm:** for each card, find the best-matching `card_reward_categories` row for `category_key` (fall back to the general rate); compute raw units earned (points/miles/cashback), convert to ₹ using the matching `point_valuations.estimated_inr_per_point_typical`; check the card's `card_bonuses` for a milestone within a configurable proximity window (e.g. within 20% of the threshold) and include a nudge string if so. Sort descending by estimated ₹ value.

**Output:** `[{ "card_id": "...", "estimated_value_inr": 45, "redemption_note": "Value varies by redemption channel — this assumes typical statement-credit redemption", "milestone_nudge": "₹4,200 more spend unlocks this card's next milestone bonus" }]`

### 9.4 `detect-card-changes` (scheduled, weekly)

For each card, compare its two most recent `card_snapshots` rows. Diff a fixed watch-list of fields (`joining_fee_amount`, `annual_fee_amount`, `annual_fee_waiver_spend_amount`, `forex_markup_pct`, `reward_rate_general_text`, `cibil_min`, `lounge_domestic_visits_per_year`, `lounge_intl_visits_per_year`, plus any `card_reward_categories`/`card_fees` rows). For every material difference, insert a `card_change_log` row with a human-readable `summary` (e.g. `"Annual fee increased from ₹500 to ₹750"`). Trigger `send-change-alerts` for any newly-inserted rows where the affected card is in someone's `user_wallet_cards`.

### 9.5 `send-fee-waiver-reminders` (scheduled, daily)

For each `user_wallet_cards` row with a `card_opened_date`/`billing_cycle_day` set, compute days remaining in the current fee-waiver measurement period and the spend gap against `cards.annual_fee_waiver_spend_amount`. If within a threshold window (e.g. ≤30 days remaining, gap > 0) and no matching row exists in `reminders_sent` within the last 14 days, send a reminder email via Resend and log it to `reminders_sent`.

## 10. Auth strategy

Supabase Auth. Support **mobile number + OTP** as the primary sign-in method (this is the dominant pattern in the Indian consumer-web market, per `DESIGN.md` §6.7's note on OTP-based flows) alongside email/magic-link as a secondary option. On first sign-in, create the matching `profiles` row via a Postgres trigger on `auth.users` insert, not a client-side call (avoids a race condition where a user is authenticated but has no profile row yet).

## 11. Storage buckets

- `card-images` (public read): preserves the source `card_img` relative path convention (`card-img/001_hdfc_All-Miles-Credit-Card.png` style).
- `author-headshots` (public read).

Both: service-role write only; never accept direct client uploads into these buckets for v1 (no user-generated content in the catalog yet).

## 12. Security & compliance notes

- **No PAN collection in v1.** The recommendation engine (§9.1) is a rule-based estimate, not a bureau-verified soft pull — collecting a tax-ID-equivalent field without a real bureau/aggregator partner behind it would be both unnecessary data collection and a misleading trust signal (see `FRONTEND_PROMPT.md` §11.1 for the reasoning). Revisit this schema when/if a real soft-pull partner integration is scoped.
- Treat India's **Digital Personal Data Protection Act, 2023 (DPDP Act)** as the relevant data-protection framework for anything you do collect (mobile number, email, wallet spend data) — practically: collect only what a feature actually needs, give users a way to delete their `profiles`/`user_wallet_cards`/`wallet_spend_log` data, and don't log PII in plaintext application logs. This is a genuine legal area — get real compliance sign-off before launch, this document isn't legal advice.
- The **service-role key** is a full-access credential. It belongs in Edge Function environment variables and in the import script's local `.env` (never committed) — it must never appear in any file that ships to the browser, and never in a `PUBLIC_`-prefixed Astro env var.
- Every table gets an explicit RLS policy per §5 — no exceptions, no "public for now, will lock down later" tables.

## 13. Environment variables

```
SUPABASE_URL=
SUPABASE_ANON_KEY=            # safe for client bundle
SUPABASE_SERVICE_ROLE_KEY=    # server/Edge Function/import-script only, never client
RESEND_API_KEY=               # transactional email
ANTHROPIC_API_KEY=            # for the §7.2 LLM enrichment script only
```

## 14. Migration/seed structure

```
supabase/
  migrations/       one file per schema change, sequential timestamps
  functions/
    recommend-cards/
    optimize-combo/
    best-card-for-purchase/
    detect-card-changes/
    send-fee-waiver-reminders/
  seed/
    categories.sql
    point_valuations.sql   # populate before recommend-cards/best-card-for-purchase go live
scripts/
  import-cards.ts           # §7.1
  enrich-cards-llm.ts        # §7.2
```

## 15. Build order

1. Core catalog schema (§4.1) + RLS + `banks`/`categories` seed.
2. Import pipeline (§7.1) against a small sample (5–10 cards), verify parsing correctness by hand before running the full 270+.
3. LLM enrichment pass (§7.2) + manual spot-check of a sample of `needs_review` rows.
4. `point_valuations` seed data (editorial task, do this before step 5).
5. `recommend-cards` Edge Function, test against real imported data.
6. `optimize-combo`, `best-card-for-purchase`.
7. Auth + `profiles`/`user_wallet_cards`/`wallet_spend_log` + wallet-related RLS.
8. `card_snapshots` + `detect-card-changes` + `card_change_log`.
9. `send-fee-waiver-reminders` cron.
10. Search (`tsvector`/`search_site`), `card_click_events`, `newsletter_subscribers`.

## 16. Definition of done

Full import of all 270+ source cards with a `data_quality_flags` report showing zero cards missing `annual_fee_amount`, `cibil_min`, or all `card_reward_categories` rows (or an explicit, reviewed reason why a given card genuinely has none). Every table has an RLS policy verified by testing as `anon`, an unrelated `authenticated` user, and the row-owning `authenticated` user. All three Edge Functions return correct results against at least 10 manually-verified test cases each (hand-check the math, don't just check that it returns *a* response). `point_valuations` populated for every bank program actually referenced by a card in the catalog.
