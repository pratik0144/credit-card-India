-- =====================================================================
-- 20260703000007_data_quality.sql
-- Post-import validation surface (§7.3). Flags cards missing critical
-- fields so the recommendation engine never treats "missing income
-- requirement" as "no income requirement".
-- =====================================================================

create or replace view public.data_quality_flags
with (security_invoker = true) as
select
  c.id                                          as card_id,
  c.slug                                         as card_slug,
  c.name                                         as card_name,
  (c.annual_fee_amount is null)                  as missing_annual_fee,
  (c.cibil_min is null)                          as missing_cibil_min,
  (not exists (select 1 from public.card_reward_categories rc where rc.card_id = c.id))
                                                 as missing_reward_categories,
  (not exists (select 1 from public.card_eligibility e where e.card_id = c.id))
                                                 as missing_eligibility,
  c.data_confidence
from public.cards c
where c.is_active = true
  and (
       c.annual_fee_amount is null
    or c.cibil_min is null
    or not exists (select 1 from public.card_reward_categories rc where rc.card_id = c.id)
    or not exists (select 1 from public.card_eligibility e where e.card_id = c.id)
  );

grant select on public.data_quality_flags to service_role;
