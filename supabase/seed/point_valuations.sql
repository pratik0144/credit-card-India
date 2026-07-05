-- =====================================================================
-- seed/point_valuations.sql — assumed ₹-per-point conversions (§4.5).
--
-- One row per major bank reward program actually present across the 368
-- catalog cards (bank list derived from Master-data-banks.json — all 20
-- issuers are represented; cashback issuers get a 1.0 statement-credit row).
--
-- !!! EDITORIAL SIGN-OFF REQUIRED BEFORE recommend-cards / best-card GO LIVE !!!
-- Every estimated_inr_per_point_* value below is a GENUINE ESTIMATE grounded in
-- commonly-published redemption ranges for these programs, NOT sourced from each
-- issuer's own rate card. `notes` records the basis; `last_reviewed_at` is the
-- seed date. Per BACKEND §7.2 / §16 an editor MUST verify these against current
-- issuer redemption charts before the value math ships — otherwise every
-- ₹-value the site shows is fabricated precision. Treat min/typical/max as a
-- conservative band, not a promise.
--
-- Idempotent: matches on (bank slug, program_name). Re-runnable.
-- =====================================================================

-- Upsert helper: resolve bank_id by slug at insert time.
insert into public.point_valuations
  (bank_id, program_name, reward_type, redemption_channel,
   estimated_inr_per_point_min, estimated_inr_per_point_typical, estimated_inr_per_point_max,
   notes, last_reviewed_at)
select b.id, v.program_name, v.reward_type, v.redemption_channel,
       v.pmin, v.ptyp, v.pmax, v.notes, date '2026-07-03'
from (values
  -- bank_slug, program_name, reward_type, channel, min, typical, max, notes
  ('hdfc-bank','HDFC Reward Points','points','voucher',0.20,0.30,0.50,
     'ESTIMATE. HDFC RP value swings widely by redemption (SmartBuy flights/hotels higher; product catalog lower). Typical ~₹0.30. Verify against current SmartBuy rates.'),
  ('hdfc-bank','HDFC CashPoints','cashback','statement_credit',1.00,1.00,1.00,
     'CashPoints redeem ~1:1 as statement credit on eligible cards. Verify per-card minimum redemption.'),
  ('icici-bank','ICICI Reward Points','points','voucher',0.20,0.25,0.40,
     'ESTIMATE. ICICI RP typically ~₹0.25 on vouchers; higher on select premium redemptions. Verify.'),
  ('axis-bank','Axis EDGE Reward Points','points','voucher',0.15,0.20,0.40,
     'ESTIMATE. EDGE points ~₹0.20 typical; EDGE Miles transfers can exceed this. Verify current EDGE catalog.'),
  ('axis-bank','Axis EDGE Miles','miles','flight_transfer',0.40,0.80,1.20,
     'ESTIMATE. Edge Miles transfer to airline partners; value varies sharply by partner/redemption. Verify.'),
  ('state-bank-of-india','SBI Reward Points','points','voucher',0.20,0.25,0.25,
     'ESTIMATE. SBI RP commonly quoted at ~₹0.25 for the SBI rewards catalog. Verify current catalog.'),
  ('kotak-mahindra-bank','Kotak Reward Points','points','voucher',0.20,0.25,0.40,
     'ESTIMATE. Kotak RP typical ~₹0.25 on vouchers. Verify current redemption store.'),
  ('indusind-bank','IndusInd Reward Points','points','voucher',0.20,0.30,0.70,
     'ESTIMATE. IndusInd RP value varies by variant/redemption; premium variants richer. Verify.'),
  ('idfc-first-bank','IDFC FIRST Reward Points','points','voucher',0.20,0.25,0.25,
     'ESTIMATE. IDFC FIRST points ~₹0.25 typical. Verify current rewards catalog.'),
  ('au-small-finance-bank','AU Reward Points','points','voucher',0.20,0.25,0.40,
     'ESTIMATE. AU SFB RP ~₹0.25 typical. Verify per-card redemption chart.'),
  ('yes-bank','YES Reward Points','points','voucher',0.15,0.20,0.30,
     'ESTIMATE. YES Bank RP ~₹0.20 typical on vouchers. Verify.'),
  ('rbl-bank','RBL Reward Points','points','voucher',0.20,0.25,0.40,
     'ESTIMATE. RBL RP ~₹0.25 typical. Verify current catalog.'),
  ('federal-bank','Federal Reward Points','points','voucher',0.20,0.25,0.30,
     'ESTIMATE. Federal Bank RP ~₹0.25 typical. Verify.'),
  ('standard-chartered-bank','Standard Chartered Reward Points','points','voucher',0.20,0.25,0.50,
     'ESTIMATE. SC RP ~₹0.25 typical; higher on select redemptions. Verify.'),
  ('hsbc-india','HSBC Reward Points','points','voucher',0.20,0.25,0.40,
     'ESTIMATE. HSBC India RP ~₹0.25 typical. Verify.'),
  ('american-express','Amex Membership Rewards','points','flight_transfer',0.40,0.75,1.00,
     'ESTIMATE. Amex MR value driven by airline/hotel transfers; catalog redemptions lower (~₹0.40). Verify current MR partners.'),
  ('bank-of-baroda','BOB Reward Points','points','voucher',0.20,0.25,0.25,
     'ESTIMATE. Bank of Baroda RP ~₹0.25 typical. Verify.'),
  ('punjab-national-bank','PNB Reward Points','points','voucher',0.20,0.25,0.25,
     'ESTIMATE. PNB RP ~₹0.25 typical. Verify.'),
  ('canara-bank','Canara Reward Points','points','voucher',0.20,0.25,0.25,
     'ESTIMATE. Canara Bank RP ~₹0.25 typical. Verify.'),
  ('indian-bank','Indian Bank Reward Points','points','voucher',0.20,0.25,0.25,
     'ESTIMATE. Indian Bank RP ~₹0.25 typical. Verify.'),
  ('bank-of-india','Bank of India Reward Points','points','voucher',0.20,0.25,0.25,
     'ESTIMATE. Bank of India RP ~₹0.25 typical. Verify.'),
  ('union-bank-of-india','Union Bank Reward Points','points','voucher',0.20,0.25,0.25,
     'ESTIMATE. Union Bank of India RP ~₹0.25 typical. Verify.')
) as v(bank_slug, program_name, reward_type, redemption_channel, pmin, ptyp, pmax, notes)
join public.banks b on b.slug = v.bank_slug
on conflict do nothing;

-- Generic cashback / miles fallback rows (bank-agnostic) used when a card's
-- issuer program isn't individually listed above.
insert into public.point_valuations
  (bank_id, program_name, reward_type, redemption_channel,
   estimated_inr_per_point_min, estimated_inr_per_point_typical, estimated_inr_per_point_max,
   notes, last_reviewed_at)
values
  (null,'Generic Cashback','cashback','statement_credit',1.00,1.00,1.00,
     'Cashback assumed to redeem at face value (₹1 per ₹1) as statement credit. Baseline fallback.'),
  (null,'Generic Points','points','voucher',0.20,0.25,0.30,
     'ESTIMATE fallback for reward-point programs not individually valued. ~₹0.25/point. Needs editorial review.'),
  (null,'Generic Miles','miles','flight_transfer',0.40,0.75,1.20,
     'ESTIMATE fallback for miles programs not individually valued. Highly redemption-dependent. Needs editorial review.')
on conflict do nothing;

-- Review reminder (visible in query output; harmless if run twice).
do $$
begin
  raise notice 'point_valuations seeded as ESTIMATES. Editorial sign-off required before recommend-cards / best-card-for-purchase go live (BACKEND §7.2, §16).';
end $$;
