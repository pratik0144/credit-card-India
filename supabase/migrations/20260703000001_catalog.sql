-- =====================================================================
-- 20260703000001_catalog.sql
-- Core catalog schema (BACKEND_PROMPT.md §4.1) + RLS (§5).
-- Public read on catalog tables; service_role full write. RLS ON everywhere.
-- =====================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- banks
-- ---------------------------------------------------------------------
create table if not exists public.banks (
  id                            uuid primary key default gen_random_uuid(),
  slug                          text unique not null,
  name                          text not null,
  logo_url                      text,
  official_website              text,
  about                         text,
  is_scheduled_commercial_bank  boolean not null default true,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- categories (content / nav taxonomy)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  description   text,
  display_order int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- cards (core)
-- ---------------------------------------------------------------------
create table if not exists public.cards (
  id                              uuid primary key default gen_random_uuid(),
  bank_id                         uuid not null references public.banks(id) on delete restrict,
  slug                            text unique not null,
  name                            text not null,
  image_url                       text,
  card_type                       text not null check (card_type in ('credit','debit')),
  network                         text check (network in ('visa','mastercard','rupay','amex','diners')),
  network_is_estimated            boolean not null default false,
  tier                            text,
  official_url                    text,
  last_verified_at                timestamptz,
  joining_fee_amount              numeric,
  joining_fee_raw                 text,
  annual_fee_amount               numeric,
  annual_fee_raw                  text,
  annual_fee_waiver_spend_amount  numeric,
  annual_fee_waiver_spend_raw     text,
  forex_markup_pct                numeric,
  reward_type                     text check (reward_type in ('points','cashback','miles','hybrid')),
  reward_rate_general_text        text,
  base_reward_value_inr_per_100   numeric,
  fuel_surcharge_waiver_text      text,
  fuel_surcharge_waiver_pct       numeric,
  lounge_domestic_visits_per_year int,
  lounge_domestic_text            text,
  lounge_intl_visits_per_year     int,
  lounge_intl_network             text,
  lounge_intl_text                text,
  supports_contactless            boolean,
  supports_upi                    boolean,
  age_min                         int,
  age_max                         int,
  cibil_min                       int,
  cibil_min_is_estimated          boolean not null default false,
  editorial_score_raw             text,
  editorial_score_5               numeric(2,1),
  data_confidence                 text not null default 'partially_estimated'
                                    check (data_confidence in ('verified','partially_estimated','estimated')),
  raw_source                      jsonb not null default '{}'::jsonb,
  estimated_fields                text[] not null default '{}',
  is_active                       boolean not null default true,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  unique (bank_id, slug)
);
create index if not exists idx_cards_bank_id on public.cards(bank_id);
create index if not exists idx_cards_annual_fee on public.cards(annual_fee_amount);
create index if not exists idx_cards_cibil_min on public.cards(cibil_min);
create index if not exists idx_cards_is_active on public.cards(is_active);

-- ---------------------------------------------------------------------
-- card_categories (junction, content taxonomy)
-- ---------------------------------------------------------------------
create table if not exists public.card_categories (
  card_id     uuid not null references public.cards(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (card_id, category_id)
);
create index if not exists idx_card_categories_category on public.card_categories(category_id);

-- ---------------------------------------------------------------------
-- card_reward_categories (spend-category reward rates)
-- ---------------------------------------------------------------------
create table if not exists public.card_reward_categories (
  id            uuid primary key default gen_random_uuid(),
  card_id       uuid not null references public.cards(id) on delete cascade,
  category_key  text not null check (category_key in (
                  'general','groceries','online_shopping','dining','travel_flights',
                  'travel_hotels','fuel','utility_bills','emi_large_purchases',
                  'entertainment','other')),
  multiplier    numeric,
  rate_pct      numeric,
  cap_amount    numeric,
  cap_period    text check (cap_period in ('monthly','billing_cycle','yearly')),
  raw_text      text,
  parsed_by_llm boolean not null default false,
  needs_review  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_crc_card on public.card_reward_categories(card_id);
create index if not exists idx_crc_key on public.card_reward_categories(category_key);
create index if not exists idx_crc_needs_review on public.card_reward_categories(needs_review);

-- ---------------------------------------------------------------------
-- card_bonuses
-- ---------------------------------------------------------------------
create table if not exists public.card_bonuses (
  id                     uuid primary key default gen_random_uuid(),
  card_id                uuid not null references public.cards(id) on delete cascade,
  bonus_type             text not null check (bonus_type in ('welcome','milestone','anniversary','other')),
  description            text,
  threshold_spend_amount numeric,
  threshold_period       text,
  estimated_value_inr    numeric,
  is_estimated           boolean not null default false,
  valid_until            date,
  parsed_by_llm          boolean not null default false,
  needs_review           boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_bonuses_card on public.card_bonuses(card_id);

-- ---------------------------------------------------------------------
-- card_offers
-- ---------------------------------------------------------------------
create table if not exists public.card_offers (
  id            uuid primary key default gen_random_uuid(),
  card_id       uuid not null references public.cards(id) on delete cascade,
  offer_text    text not null,
  category      text,
  valid_until   date,
  is_estimated  boolean not null default false,
  parsed_by_llm boolean not null default false,
  needs_review  boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_offers_card on public.card_offers(card_id);

-- ---------------------------------------------------------------------
-- card_fees
-- ---------------------------------------------------------------------
create table if not exists public.card_fees (
  id            uuid primary key default gen_random_uuid(),
  card_id       uuid not null references public.cards(id) on delete cascade,
  fee_type      text not null check (fee_type in (
                  'joining','annual','renewal','cash_advance','late_payment',
                  'over_limit','forex_markup','add_on_card','reward_redemption','other')),
  amount        numeric,
  is_percentage boolean not null default false,
  min_amount    numeric,
  max_amount    numeric,
  raw_text      text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_fees_card on public.card_fees(card_id);

-- ---------------------------------------------------------------------
-- card_eligibility
-- ---------------------------------------------------------------------
create table if not exists public.card_eligibility (
  id                uuid primary key default gen_random_uuid(),
  card_id           uuid not null references public.cards(id) on delete cascade,
  employment_type   text not null check (employment_type in ('salaried','self_employed','student','any')),
  min_income_amount numeric,
  min_income_period text check (min_income_period in ('monthly','annual')),
  raw_text          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_elig_card on public.card_eligibility(card_id);

-- ---------------------------------------------------------------------
-- card_snapshots (INTERNAL ONLY — never anon/authenticated)
-- ---------------------------------------------------------------------
create table if not exists public.card_snapshots (
  id             uuid primary key default gen_random_uuid(),
  card_id        uuid not null references public.cards(id) on delete cascade,
  snapshot       jsonb not null,
  snapshotted_at timestamptz not null default now()
);
create index if not exists idx_snapshots_card_time on public.card_snapshots(card_id, snapshotted_at desc);

-- ---------------------------------------------------------------------
-- card_change_log
-- ---------------------------------------------------------------------
create table if not exists public.card_change_log (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.cards(id) on delete cascade,
  detected_at timestamptz not null default now(),
  change_type text not null check (change_type in (
                'fee_increase','fee_decrease','reward_devaluation','reward_improvement',
                'benefit_added','benefit_removed','eligibility_change','other')),
  field_name  text,
  old_value   text,
  new_value   text,
  summary     text not null,
  source_note text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_changelog_card on public.card_change_log(card_id, detected_at desc);

-- =====================================================================
-- RLS  (§5) — enable + explicit policies.
-- Catalog tables: anon+authenticated SELECT, service_role full.
-- (Supabase applies the service_role key with BYPASSRLS, but we still add an
--  explicit permissive policy so the intent is documented in-schema.)
-- =====================================================================

-- helper: reused pattern applied per table below.
alter table public.banks                  enable row level security;
alter table public.categories             enable row level security;
alter table public.cards                  enable row level security;
alter table public.card_categories        enable row level security;
alter table public.card_reward_categories enable row level security;
alter table public.card_bonuses           enable row level security;
alter table public.card_offers            enable row level security;
alter table public.card_fees              enable row level security;
alter table public.card_eligibility       enable row level security;
alter table public.card_change_log        enable row level security;
alter table public.card_snapshots         enable row level security;

-- Public-read catalog tables ------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'banks','categories','cards','card_categories','card_reward_categories',
    'card_bonuses','card_offers','card_fees','card_eligibility','card_change_log'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true);',
      t || '_public_read', t);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true);',
      t || '_service_all', t);
  end loop;
end $$;

-- card_snapshots: service_role only, no anon/authenticated access -------
create policy card_snapshots_service_all on public.card_snapshots
  for all to service_role using (true) with check (true);
-- (no anon/authenticated policy => no access for those roles)
