-- =====================================================================
-- 20260703000002_editorial.sql
-- Editorial tables (§4.2), card_ratings (§4.1), point_valuations (§4.5).
-- RLS: public read; articles readable only when is_published = true.
-- =====================================================================

-- ---------------------------------------------------------------------
-- authors
-- ---------------------------------------------------------------------
create table if not exists public.authors (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text unique not null,
  name                    text not null,
  title                   text,
  headshot_url            text,
  bio                     text,
  expertise_tags          text[] not null default '{}',
  highlights              text[] not null default '{}',
  is_review_board_member  boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- card_ratings (editorial workflow only — never the import script)
-- ---------------------------------------------------------------------
create table if not exists public.card_ratings (
  card_id               uuid primary key references public.cards(id) on delete cascade,
  overall_score         numeric(2,1),
  rewards_value_score   numeric(2,1),
  fees_charges_score    numeric(2,1),
  welcome_benefit_score numeric(2,1),
  flexibility_score     numeric(2,1),
  issuer_service_score  numeric(2,1),
  methodology_note      text,
  rated_by              uuid references public.authors(id) on delete set null,
  rated_at              timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- articles
-- ---------------------------------------------------------------------
create table if not exists public.articles (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text unique not null,
  title                  text not null,
  article_type           text not null check (article_type in ('card_review','category_roundup','guide','news')),
  author_id              uuid references public.authors(id) on delete set null,
  edited_by_author_id    uuid references public.authors(id) on delete set null,
  reviewed_by_author_id  uuid references public.authors(id) on delete set null,
  related_card_id        uuid references public.cards(id) on delete set null,
  body                   text not null default '',
  meta_description       text,
  og_image_url           text,
  published_at           timestamptz,
  is_published           boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index if not exists idx_articles_published on public.articles(is_published, published_at desc);
create index if not exists idx_articles_related_card on public.articles(related_card_id);

-- ---------------------------------------------------------------------
-- point_valuations (reference — populate editorially before recommend-cards)
-- ---------------------------------------------------------------------
create table if not exists public.point_valuations (
  id                              uuid primary key default gen_random_uuid(),
  bank_id                         uuid references public.banks(id) on delete set null,
  program_name                    text not null,
  reward_type                     text not null,
  redemption_channel              text not null check (redemption_channel in
                                    ('flight_transfer','voucher','statement_credit','other')),
  estimated_inr_per_point_min     numeric,
  estimated_inr_per_point_typical numeric,
  estimated_inr_per_point_max     numeric,
  notes                           text,
  last_reviewed_at                date,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);
create index if not exists idx_pv_bank on public.point_valuations(bank_id);

-- =====================================================================
-- RLS (§5)
-- =====================================================================
alter table public.authors          enable row level security;
alter table public.card_ratings     enable row level security;
alter table public.articles         enable row level security;
alter table public.point_valuations enable row level security;

-- authors, card_ratings, point_valuations: public read, service write.
do $$
declare t text;
begin
  foreach t in array array['authors','card_ratings','point_valuations']
  loop
    execute format('create policy %I on public.%I for select to anon, authenticated using (true);',
      t || '_public_read', t);
    execute format('create policy %I on public.%I for all to service_role using (true) with check (true);',
      t || '_service_all', t);
  end loop;
end $$;

-- articles: public read ONLY where is_published = true.
create policy articles_public_read on public.articles
  for select to anon, authenticated using (is_published = true);
create policy articles_service_all on public.articles
  for all to service_role using (true) with check (true);
