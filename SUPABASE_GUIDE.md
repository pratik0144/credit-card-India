# Supabase Setup Guide — CardCompare.in

This is the complete, do-this-in-order guide to standing up the backend so the
site shows **real data** instead of the built-in seed fallback.

> **Short answer to "do I need a Supabase project and do I paste the 7 migrations
> into the SQL Editor?"** — **Yes.** You create one Supabase project, run the 7
> migration files in order (SQL Editor *or* CLI), run the 2 seed files, then run
> the import script to load the 368 cards. Then rebuild the site. Details below.

---

## 0. How the frontend decides seed vs live

`src/lib/queries.ts` chooses its data source at runtime:

| Situation | What renders |
|---|---|
| `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` **not** set | Seed data (`src/lib/seed-data.ts`) — 8 cards / 6 banks |
| Env set, but a query **errors** (tables not migrated) | Seed data + a `[queries] … falling back` console warning |
| Env set, but a query returns **0 rows** (not imported) | Seed data + a `falling back … 0 rows` warning |
| Env set **and** tables have data | **Live Supabase data** |

So "not a single card shows" earlier meant: env was set, but the catalog was
empty. The fix is to populate it (this guide). The seed fallback guarantees the
site is never blank while you do.

> **Prerendered pages are built once.** `/`, `/best/*`, `/cards/*` are static
> (SSG). Data is read **at build time**. After you import data you **must
> rebuild** (`npm run build`) for those pages to show live data. In `npm run dev`
> queries run per request, so a refresh is enough there.

---

## 1. Create the project

1. Go to <https://supabase.com/dashboard> → **New project**.
2. Pick a region close to your users — **Mumbai (ap-south-1)** for India.
3. Save the database password.
4. When it's ready, open **Project Settings → API** and copy:
   - **Project URL** → `PUBLIC_SUPABASE_URL` and `SUPABASE_URL`
   - **anon public** key → `PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ server-only, never in a `PUBLIC_` var)

Put them in `.env` (copy from `.env.example`):

```env
PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
# optional
RESEND_API_KEY=
DEPLOY_HOOK_URL=
```

---

## 2. Run the 7 migrations (in order)

You have two options. **Pick one.** Order matters — later files depend on
earlier tables.

| # | File | Creates |
|---|---|---|
| 1 | `20260703000001_catalog.sql` | `banks`, `categories`, `cards`, all `card_*` satellites, `card_snapshots`, `card_change_log` + RLS |
| 2 | `20260703000002_editorial.sql` | `authors`, `articles`, `point_valuations` + RLS |
| 3 | `20260703000003_user_wallet.sql` | `profiles`, `user_wallet_cards`, `wallet_spend_log`, sessions, `newsletter_subscribers`, `card_click_events`, `reminders_sent` + the `auth.users → profiles` trigger + RLS |
| 4 | `20260703000004_views.sql` | `card_listing_view`, `wallet_summary_view` |
| 5 | `20260703000005_search.sql` | `tsvector` columns, GIN indexes, `search_site()` RPC |
| 6 | `20260703000006_storage.sql` | Storage buckets `card-images`, `author-headshots` + policies |
| 7 | `20260703000007_data_quality.sql` | `data_quality_flags` view |

### Option A — SQL Editor (simplest, no tooling)

For each file 1→7, in order:
1. Supabase Dashboard → **SQL Editor** → **New query**.
2. Open the file from `supabase/migrations/`, copy its **entire** contents, paste, **Run**.
3. Confirm "Success" before moving to the next file.

> Migrations are written to be idempotent where practical (`create table if not
> exists`, `on conflict do update`). One exception: `create policy` has no "if
> not exists" in Postgres — if you re-run file 6 you may see *"policy already
> exists"*. That's harmless; it means it already ran. To re-run cleanly, drop the
> named policies first or just skip that file.

### Option B — Supabase CLI (repeatable, recommended)

```bash
npm i -g supabase        # or: brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push         # applies everything in supabase/migrations/ in order
```

The CLI tracks which migrations have run, so it's safe to re-run.

---

## 3. Seed reference data

Two files under `supabase/seed/`. Run **after** migrations.

**SQL Editor:** paste and run each file's contents.
**CLI / psql:**
```bash
psql "$DATABASE_URL" -f supabase/seed/categories.sql
psql "$DATABASE_URL" -f supabase/seed/point_valuations.sql
```

- `categories.sql` — the 12 content categories (`/best/[category]` pages).
- `point_valuations.sql` — ₹-per-point estimates per bank program. **These need
  editorial review before the recommendation engine is trusted** — every ₹-value
  the site shows is built on them.

---

## 4. Import the 368 cards

This is the step that makes cards appear. It reads
`bank-data/cc-data/Master-data-banks.json`, parses every field, and upserts into
`banks`, `cards`, `card_categories`, `card_eligibility`, plus a `card_snapshots`
row per card.

```bash
# 1) Dry run — parses all 368, prints coverage + §7.3 quality report, NO writes:
npm run import:cards -- --dry-run

# 2) Live import — needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env:
npm run import:cards
```

Expected dry-run summary: 368 parsed, 20 banks, ~98% annual-fee coverage, 100%
reward-type / category / eligibility coverage.

> **Reward-category data (used by the recommender/optimizer) is a separate pass.**
> `import-cards.ts` does NOT fill `card_reward_categories` — run the deterministic
> enrichment step next (parses the source JSON's free-text reward/bonus/offer
> prose; **no external API**):
> ```bash
> npm run enrich:cards -- --dry-run     # parses + prints a sample, no writes
> npm run enrich:cards                   # inserts reward categories/bonuses/offers
> ```
> Until you run this, `card_reward_categories` is empty and the recommendation /
> combo / best-card Edge Functions fall back to each card's general rate.

### Card images

The import uploads card art to the `card-images` bucket (preserving the
`card-img/…` path). For **local** rendering the 12 seed images already sit in
`public/card-img/`. For the full 368 in production, either let the import upload
them to Storage, or copy `bank-data/cc-data/card-img/*` into `public/card-img/`
and serve them statically.

---

## 5. Rebuild and verify

```bash
npm run build     # static pages re-read live data at build time
npm run preview   # serve the built site
# or for iterative work:
npm run dev
```

Check the console — the `[queries] … falling back to seed data` warnings should
be **gone**. If they persist, jump to Troubleshooting.

Quick DB sanity checks (SQL Editor):
```sql
select count(*) from cards;                 -- expect ~368
select count(*) from card_listing_view;     -- expect ~ number of active cards
select * from data_quality_flags;           -- §7.3 report: missing fees/cibil/etc.
select count(*) from card_reward_categories; -- 0 until you run enrich:cards
```

---

## 6. Deploy the Edge Functions (for the interactive tools)

The recommend / combo / best-card tools call Edge Functions. Deploy them so those
pages return real results instead of the "preview" state:

```bash
supabase functions deploy recommend-cards optimize-combo best-card-for-purchase \
  detect-card-changes send-change-alerts send-fee-waiver-reminders

# secrets the functions need (only the email functions need Resend):
supabase secrets set RESEND_API_KEY=...
```

Schedule the two cron functions (Dashboard → Database → Cron, or `pg_cron`):
```sql
select cron.schedule('detect-card-changes', '37 0 * * 1',
  $$ select net.http_post(
       url := 'https://<ref>.functions.supabase.co/detect-card-changes',
       headers := jsonb_build_object('Authorization','Bearer <service-role>')) $$);

select cron.schedule('fee-waiver-reminders', '37 3 * * *',
  $$ select net.http_post(
       url := 'https://<ref>.functions.supabase.co/send-fee-waiver-reminders',
       headers := jsonb_build_object('Authorization','Bearer <service-role>')) $$);
```

---

## 7. Verify RLS (before going public)

RLS is on for every table. Sanity-check the boundary:

```sql
-- Public catalog should be readable by anon:
set role anon;
select count(*) from cards;                 -- should return the count (public read)
select * from user_wallet_cards;            -- should return 0 rows / be blocked
select * from newsletter_subscribers;       -- should be blocked (protect emails)
reset role;
```

Cards, categories, banks, ratings, articles (published), authors, and
point_valuations are anon-readable. Wallet/profile/spend data is only readable by
its owner (`auth.uid()`). If anon `select count(*) from cards` returns 0 **after**
import, an RLS policy on `cards` is missing its `to anon` select — re-check
migration 1.

---

## Troubleshooting: "still no cards after import"

Work down this list:

1. **Did the static pages get rebuilt?** SSG reads data at build time. Run
   `npm run build` again (or use `npm run dev`).
2. **Env actually loaded?** `PUBLIC_*` vars must be present when Astro builds.
   `echo $PUBLIC_SUPABASE_URL` or check `.env` is in the project root.
3. **Import actually wrote rows?** `select count(*) from cards;` in SQL Editor.
   If 0, re-run `npm run import:cards` and read its output for errors.
4. **RLS blocking anon reads?** See §7. The anon key is what the browser/build
   uses; if anon can't `select` on `cards`, the view returns 0 rows.
5. **Console warnings?** `npm run build` prints exactly which query fell back and
   why (`error` = tables missing → run migrations; `0 rows` = empty → import).
6. **Right project?** Confirm `PUBLIC_SUPABASE_URL` matches the project you ran
   migrations in (easy to mix up two projects/refs).

---

## Reference: Supabase agent skills / conventions

This guide follows Supabase's recommended conventions: versioned SQL migrations
under `supabase/migrations/`, RLS enabled in the same migration that creates each
table, Deno Edge Functions under `supabase/functions/`, and `pg_cron`/Cron
Triggers for scheduled jobs. If you use the Supabase MCP server or its agent
skills to drive setup, point them at `supabase/migrations/` (apply in filename
order) and `supabase/functions/` — the file layout already matches what those
tools expect. See also `supabase/README.md` for the backend-engineer view.
