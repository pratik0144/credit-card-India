-- =====================================================================
-- 20260703000004_views.sql
-- Postgres views (§4.6): card_listing_view, wallet_summary_view.
-- Views run with the querying user's privileges (security_invoker) so the
-- underlying table RLS still applies — critical for wallet_summary_view.
-- =====================================================================

-- ---------------------------------------------------------------------
-- card_listing_view — powers /best/[category] filter/sort.
-- Flattens cards + banks + best-primary-content-category + overall_score +
-- a computed headline reward line.
-- ---------------------------------------------------------------------
create or replace view public.card_listing_view
with (security_invoker = true) as
select
  c.id                             as card_id,
  c.slug                           as card_slug,
  c.name                           as card_name,
  b.slug                           as bank_slug,
  b.name                           as bank_name,
  c.image_url,
  pc.primary_category_slug,
  c.annual_fee_amount,
  c.cibil_min,
  r.overall_score,
  -- headline reward line: prefer the raw general-rate text; else a % / value.
  coalesce(
    nullif(c.reward_rate_general_text, ''),
    case when c.base_reward_value_inr_per_100 is not null
         then '~₹' || round(c.base_reward_value_inr_per_100, 1)::text || ' back per ₹100'
         else null end
  )                                as headline_reward_line,
  c.reward_type,
  c.data_confidence
from public.cards c
join public.banks b on b.id = c.bank_id
left join public.card_ratings r on r.card_id = c.id
left join lateral (
  -- best primary content category: is_primary rows first, else lowest display_order.
  select cat.slug as primary_category_slug
  from public.card_categories cc
  join public.categories cat on cat.id = cc.category_id
  where cc.card_id = c.id
  order by cc.is_primary desc, cat.display_order asc
  limit 1
) pc on true
where c.is_active = true;

-- ---------------------------------------------------------------------
-- wallet_summary_view — per-user /wallet dashboard aggregation.
-- RLS-scoped: security_invoker means the caller only sees their own
-- user_wallet_cards rows (per §5 owner policy).
-- ---------------------------------------------------------------------
create or replace view public.wallet_summary_view
with (security_invoker = true) as
select
  w.user_id,
  count(*)                                          as card_count,
  coalesce(sum(c.annual_fee_amount), 0)             as total_annual_fees_inr,
  coalesce(sum(coalesce(c.lounge_domestic_visits_per_year, 0)
              + coalesce(c.lounge_intl_visits_per_year, 0)), 0) as total_lounge_visits_per_year,
  -- upcoming renewals: cards whose next annual anniversary is within 30 days.
  count(*) filter (
    where w.card_opened_date is not null
      and (
        -- days until the next yearly anniversary of card_opened_date
        ((extract(doy from w.card_opened_date)::int - extract(doy from current_date)::int) + 365) % 365
      ) <= 30
  )                                                  as renewals_due_30d
from public.user_wallet_cards w
join public.cards c on c.id = w.card_id
group by w.user_id;

-- Views inherit no RLS of their own; access is governed by security_invoker +
-- the base tables. Grant select so the roles can reference the views.
grant select on public.card_listing_view   to anon, authenticated;
grant select on public.wallet_summary_view  to authenticated;
