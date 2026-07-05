-- =====================================================================
-- 20260703000005_search.sql
-- Full-text search (§8): generated tsvector columns + GIN indexes on
-- cards and articles, plus a unioned ranked search_site(query) RPC.
-- =====================================================================

-- ---------------------------------------------------------------------
-- cards.search_tsv — over name + tier + reward_rate_general_text.
-- (bank name is denormalized in via a maintained column to keep the
--  generated column immutable — see cards_bank_name_sync trigger below.)
-- ---------------------------------------------------------------------
alter table public.cards
  add column if not exists bank_name_cache text;

-- keep bank_name_cache in sync so the tsvector can include it.
create or replace function public.sync_card_bank_name()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select b.name into new.bank_name_cache from public.banks b where b.id = new.bank_id;
  return new;
end;
$$;

drop trigger if exists trg_sync_card_bank_name on public.cards;
create trigger trg_sync_card_bank_name
  before insert or update of bank_id on public.cards
  for each row execute function public.sync_card_bank_name();

-- backfill any existing rows (idempotent).
update public.cards c
set bank_name_cache = b.name
from public.banks b
where b.id = c.bank_id
  and (c.bank_name_cache is distinct from b.name);

alter table public.cards
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(bank_name_cache, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(tier, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(reward_rate_general_text, '')), 'D')
  ) stored;

create index if not exists idx_cards_search_tsv on public.cards using gin (search_tsv);

-- ---------------------------------------------------------------------
-- articles.search_tsv — over title + body.
-- ---------------------------------------------------------------------
alter table public.articles
  add column if not exists search_tsv tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(body, '')), 'D')
  ) stored;

create index if not exists idx_articles_search_tsv on public.articles using gin (search_tsv);

-- ---------------------------------------------------------------------
-- search_site(query) — unioned, ranked results across cards + articles.
-- SECURITY INVOKER so RLS applies (only active cards / published articles
-- visible to anon). Called via supabase.rpc('search_site', { query }).
-- ---------------------------------------------------------------------
create or replace function public.search_site(query text)
returns table (
  result_type text,
  id          uuid,
  slug        text,
  title       text,
  subtitle    text,
  image_url   text,
  rank        real
)
language sql
stable
security invoker
set search_path = public
as $$
  with q as (
    select websearch_to_tsquery('simple', coalesce(query, '')) as tsq
  )
  select
    'card'::text                          as result_type,
    c.id,
    c.slug,
    c.name                                as title,
    c.bank_name_cache                     as subtitle,
    c.image_url,
    ts_rank(c.search_tsv, q.tsq)          as rank
  from public.cards c, q
  where c.is_active = true
    and c.search_tsv @@ q.tsq

  union all

  select
    'article'::text                       as result_type,
    a.id,
    a.slug,
    a.title,
    a.meta_description                    as subtitle,
    a.og_image_url                        as image_url,
    ts_rank(a.search_tsv, q.tsq)          as rank
  from public.articles a, q
  where a.is_published = true
    and a.search_tsv @@ q.tsq

  order by rank desc
  limit 50;
$$;

grant execute on function public.search_site(text) to anon, authenticated;
