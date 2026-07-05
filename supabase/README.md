# CardCompare.in — Supabase backend

Data layer, API surface, and business logic per `instructions/BACKEND_PROMPT.md`.
Everything here is **deploy-ready code built against the documented contracts** —
there is no live project wired up yet. Follow the steps below to stand one up.

## Layout

```
supabase/
  migrations/   # sequential, RLS-in-same-migration (§5). Apply in order.
    ..._catalog.sql       banks, categories, cards + card_* satellites, snapshots, change_log
    ..._editorial.sql     authors, articles
    ..._user_wallet.sql   profiles, user_wallet_cards, wallet_spend_log, sessions, growth/ops
    ..._views.sql         card_listing_view, wallet_summary_view (§4.6)
    ..._search.sql        tsvector columns + GIN indexes + search_site() (§8)
    ..._storage.sql       card-images + author-headshots buckets (§11)
    ..._data_quality.sql  data_quality_flags view (§7.3)
  functions/
    _shared/              client (CORS + service/user clients), scoring, taxonomy
    recommend-cards/      §9.1  POST  rule-based recommendation (estimate, not a bureau check)
    optimize-combo/       §9.2  POST  greedy marginal-value combo heuristic
    best-card-for-purchase/ §9.3 POST ranked ₹-value for one purchase
    detect-card-changes/  §9.4  cron (weekly) snapshot diff -> card_change_log
    send-change-alerts/   §9.4  internal POST, invoked by detect-card-changes
    send-fee-waiver-reminders/ §9.5 cron (daily) Resend reminders
  seed/
    categories.sql        content taxonomy (§6 — NO "0% APR", DESIGN §10.9)
    point_valuations.sql  ₹-per-point estimates (§4.5) — EDITORIAL SIGN-OFF REQUIRED before go-live
scripts/
  lib/parse.ts            pure, unit-testable parsers (§7.1)
  import-cards.ts         idempotent structured import + --dry-run validation (§7.1/§7.3)
  enrich-cards.ts         deterministic extraction of reward/bonus/offer prose from JSON — no API
```

## 1. Provision & link

```bash
npm i -g supabase           # or use npx supabase
supabase login
supabase link --project-ref <your-project-ref>
```

Set the environment (never commit): copy `.env.example` → `.env` and fill
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and (optionally) `RESEND_API_KEY`.
Function secrets: `supabase secrets set RESEND_API_KEY=...`.

## 2. Apply schema + seed

```bash
supabase db push                       # applies migrations/ in order
psql "$DATABASE_URL" -f supabase/seed/categories.sql
psql "$DATABASE_URL" -f supabase/seed/point_valuations.sql
```

> **Before the recommendation engine / best-card calculator go live**, review and
> complete `point_valuations` (§4.5). Every ₹-value the site shows is built on
> these ~20–30 rows; unreviewed values = fabricated precision. This is the single
> highest-leverage editorial data-entry task in the build.

## 3. Import the catalog (§7.1 → §7.2)

```bash
# Always dry-run first to hand-verify parsing (no DB writes):
npm run import:cards -- --dry-run     # parses all 368 records, prints §7.3 report

# Live import (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY):
npm run import:cards                   # upserts banks/cards/snapshots/eligibility/categories, 1 rebuild at end

# Deterministic enrichment of reward/bonus/offer prose (parses the source JSON, no API):
npm run enrich:cards -- --dry-run      # parses + prints a sample, no writes
npm run enrich:cards                   # inserts card_reward_categories/bonuses/offers (needs_review=true)
```

Then spot-check the parsed output before flipping the recommender live (§7.2):
```sql
select * from card_reward_categories where needs_review = true order by card_id;
```

### Known §7.3 data-quality flags (from the 368-record dry-run)
- **6 cards missing `annual_fee_amount`** — invite-only premium products
  (IndusInd Pioneer Private, InterMiles Odyssey/Voyage variants) whose fee is
  genuinely undisclosed. Acceptable, reviewed reason (BACKEND §16).
- **1 non-secured card missing `cibil_min`**, **39 without a parsed income floor**
  — surfaced in `data_quality_flags`; treat "missing" as unknown, never as
  "no requirement" (§7.3). Editorial fill-in recommended.
- 100% coverage on reward_type, ≥1 content category, and ≥1 eligibility row.

## 4. Deploy Edge Functions

```bash
supabase functions deploy recommend-cards optimize-combo best-card-for-purchase \
  detect-card-changes send-change-alerts send-fee-waiver-reminders
```

Local test: `supabase functions serve` then `curl` the endpoints with the §9
input bodies. Hand-check ≥10 cases per function against the math (§16 DoD).

## 5. Schedule the cron jobs

Using Supabase Cron (dashboard → Database → Cron) or `pg_cron`:

```sql
-- Weekly change detection (Mondays 06:07 IST ≈ 00:37 UTC).
select cron.schedule('detect-card-changes', '37 0 * * 1',
  $$ select net.http_post(
       url := 'https://<ref>.functions.supabase.co/detect-card-changes',
       headers := jsonb_build_object('Authorization','Bearer <service-role>')) $$);

-- Daily fee-waiver reminders (09:07 IST ≈ 03:37 UTC).
select cron.schedule('fee-waiver-reminders', '37 3 * * *',
  $$ select net.http_post(
       url := 'https://<ref>.functions.supabase.co/send-fee-waiver-reminders',
       headers := jsonb_build_object('Authorization','Bearer <service-role>')) $$);
```

## 6. RLS verification (§16 DoD)

Test every table as three roles — `anon`, an unrelated `authenticated` user, and
the row-owning `authenticated` user — confirming wallet/profile rows are only
visible to their owner and `newsletter_subscribers` emails are never client-readable.

## Compliance notes
- No PAN/Aadhaar collected anywhere (§12, DESIGN §10.6). The recommender is a
  rule-based estimate, not a bureau soft-pull.
- `point_valuations` and any RBI/CIBIL disclosure copy need editorial + legal
  sign-off before production (DESIGN §10, §13).
