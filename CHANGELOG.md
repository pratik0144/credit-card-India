# Changelog

All notable changes to CardCompare.in. Format based on
[Keep a Changelog](https://keepachangelog.com/); this project is pre-release, so
everything currently lives under **Unreleased**.

---

## [Unreleased]

### 2026-07-05 — Deterministic enrichment, image fix, docs, live data

#### Removed
- **Anthropic / Claude API entirely.** Deleted `scripts/enrich-cards-llm.ts` and
  all `ANTHROPIC_API_KEY` usage. Reward-category / bonus / offer data is now
  derived **only from the provided source JSON**, with no external API call
  anywhere in the pipeline.
- Dropped `ANTHROPIC_API_KEY` from `.env.example` and every doc
  (`README.md`, `SUPABASE_GUIDE.md`, `architecture.md`, `supabase/README.md`).

#### Added
- **`scripts/enrich-cards.ts`** — deterministic, offline enrichment pass that
  parses each card's free-text `reward_rate_category_wise`, `all_bonus`, and
  `all_offers` fields into `card_reward_categories`, `card_bonuses`, and
  `card_offers`. Idempotent (clears a card's rows before re-inserting), with a
  `--dry-run` mode. Recomputes `cards.base_reward_value_inr_per_100` from the
  general rate × the matching `point_valuations` row.
- **New pure parsers in `scripts/lib/parse.ts`:**
  - `parseRewardCategories()` — buckets reward clauses into canonical spend
    categories via a merchant→category keyword map, reading multipliers ("5X")
    and rates ("10%"). Handles both `;`-separated clauses ("A: 3X; B: 2X") and
    comma-separated rates ("10% on X, 5% on Y"), and emits one row per category
    in a shared-rate clause ("hotel, recharge and shopping: 2X" → 3 rows).
  - `parseBonuses()` — classifies welcome / milestone / anniversary bonuses and
    extracts thresholds/values (lakh/crore-aware).
  - `parseOffers()` — splits highlight prose into discrete offers.
  - `moneyTokens()` — lakh/crore-aware money extraction helper.
- **`CHANGELOG.md`** (this file).
- **`SUPABASE_GUIDE.md`** — full setup walkthrough: project creation, the 7
  migrations (SQL Editor + CLI paths), seeding, import, enrichment, RLS
  verification, and a "no cards showing" troubleshooting checklist.
- **Supabase MCP + agent skills** — registered the Supabase MCP server in
  `.mcp.json`; installed the `supabase` and `supabase-postgres-best-practices`
  agent skills.

#### Fixed
- **Card images not displaying.** Only 12 of 368 card images were in
  `public/card-img/`, so every live card 404'd. Copied all 368 images into
  `public/card-img/` (the frontend serves `/card-img/<file>` statically).
- **Import script silently ran in dry-run.** Standalone `tsx` scripts never
  loaded `.env`, so `SUPABASE_*` were undefined. Added `process.loadEnvFile()`
  to `import-cards.ts` and `enrich-cards.ts` (+ a `PUBLIC_SUPABASE_URL` fallback).
- **Import crash on live run.** The import dynamically imported the app's
  `src/lib/supabase.ts`, which reads Vite's `import.meta.env` (undefined under
  tsx) → `TypeError`. Both scripts now build the service client directly from
  `process.env`.
- **Enrichment misparses** caught in dry-run and fixed:
  - "X% off" / discount phrases were read as reward rates (e.g. `groceries=50%`);
    now discounts are excluded and reward `%` is capped at 20.
  - Indian-grouped numbers ("₹1,00,000") were split on their internal commas,
    truncating milestone thresholds to `₹1`; splitting now only breaks on
    comma-before-letter, and thresholds use lakh/crore-aware parsing.

#### Changed
- **Data layer is now live-aware and batched.** Added
  `getCardDetailsByIds()` — assembles full `CardDetail` for many cards in a fixed
  number of queries (not N×9). Homepage, `/best/[category]`, `/banks/[bank]`, and
  `/compare` use it, so the inline "Show full card details" expand works on live
  data without exploding build time. `getCardDetailById` and
  `getCardDetailByFullSlug` are now live-aware (shared `assembleLiveDetail`).
- `npm run enrich:cards` now points at `scripts/enrich-cards.ts`.

#### Database (applied via Supabase MCP)
- Seeded **12 content categories** and **25 point valuations** (22 bank-specific
  + 3 generic fallbacks).
- Imported **359 cards / 20 banks** (368 source records; 9 merged on duplicate
  derived slugs — see Known Issues), plus 535 category links, 702 eligibility
  rows, 368 snapshots.
- Enriched all 359 cards: **534 reward-category rows, 381 bonuses, 1015 offers**;
  `data_quality_flags.missing_reward_categories` now 0.
- **Security hardening** (from Supabase security advisor): revoked public
  `EXECUTE` on the `SECURITY DEFINER` trigger functions `handle_new_user()` and
  `sync_card_bank_name()` (migration `harden_security_definer_functions`).

### 2026-07-04 — Resilient data layer

#### Added
- **Three-way resilient catalog reads** in `src/lib/queries.ts`: every catalog
  query falls back to seed data when Supabase env is absent, the query errors
  (tables not migrated), or it returns 0 rows (not imported) — so the site is
  never blank during setup. A one-time `warnOnce()` log states exactly which case
  applies. User-scoped (wallet) reads deliberately do not fall back.
- Fixed a non-focusable skip link (`.skip-link` visible on focus).

### 2026-07-03 — Initial full-stack build

#### Added — Foundation
- Astro **5.18** project at repo root (pinned down from the scaffold's Astro 7,
  whose integrations require Astro 5) + `@astrojs/node`, `@astrojs/react`,
  `@astrojs/sitemap`.
- `src/styles/tokens.css` transcribed **verbatim** from `DESIGN.md §3` (color,
  type, spacing, radius, elevation, motion); `global.css`; `BaseLayout.astro`
  with `lang="en-IN"` and SEO/JSON-LD.
- Shared contracts: `taxonomy.ts` (spend + content categories, quiz enums),
  `database.types.ts` (full schema + Edge Function I/O), `supabase.ts`,
  `edge-functions.ts`, `format.ts` (₹ lakh/crore), `site.ts`.

#### Added — Backend (`supabase/`, `scripts/`)
- **7 migrations**: catalog, editorial, user/wallet, views, search, storage,
  data-quality — RLS enabled and policy written in the same migration for every
  table; `card_listing_view` / `wallet_summary_view`; `tsvector` + `search_site`
  RPC; `auth.users → profiles` trigger.
- **6 Edge Functions**: `recommend-cards`, `optimize-combo`,
  `best-card-for-purchase`, `detect-card-changes`, `send-change-alerts`,
  `send-fee-waiver-reminders`, with shared `_shared/` scoring/taxonomy/client.
- **Import pipeline**: `import-cards.ts` (idempotent, `--dry-run`, §7.3 quality
  report) on top of `scripts/lib/parse.ts` (25+ pure parsers). Verified parsing
  of all 368 records (20 banks, ~98% fee coverage, 100% reward-type/category/
  eligibility coverage).
- Seeds: `categories.sql`, `point_valuations.sql`.

#### Added — Frontend
- Component library (`DESIGN.md §6/§7`): `CardRow` (collapsed + progressive
  disclosure), `GlobalHeader` (accessible mega-menu + mobile drawer),
  `SiteFooter` (full legal disclosures), `RatingWidget`, `ComparisonTable`,
  `ProsConsBlock`, `ScoreTierBadge`, `FilterSortBar`, `CategoryPillStrip`,
  `Breadcrumbs`, `AuthorByline`, `NewsletterForm`, `StickyApplyBanner`,
  `AffiliateDisclosure`, `AsSeenOnStrip`, `Button`.
- Full sitemap (`FRONTEND_PROMPT.md §4`): homepage, `/best/[category]`,
  `/cards/[bank]/[card]` (22-step review), `/banks/[bank]`, `/compare` (+ curated
  `[a]-vs-[b]`), `/recommend`, `/combo-optimizer`, `/calculator/best-card`,
  `/wallet` (SSR, auth-gated), `/changes`, `/cibil-score`, `/guides`, `/news`,
  `/authors`, `/search`, and legal/static pages.
- 6 React islands: `RecommendWizard` (8-question quiz), `ComboOptimizer`,
  `BestCardCalculator`, `CompareTool`, `SearchBox`, `WalletDashboard` — each with
  a graceful no-backend preview.
- SEO: JSON-LD (`FinancialProduct` / `BreadcrumbList` / `FAQPage` / `Article`),
  per-page unique titles/descriptions, canonicals, sitemap. Zero React JS on
  prerendered pages.
- Seed data (`seed-data.ts`) so the site builds and renders without a live DB.

#### Notes / build decisions
- Node adapter for local SSR; swap to Vercel/Netlify at deploy with no app-code
  change.
- All `§10` compliance copy is marked `[NEEDS LEGAL REVIEW]`; press logos,
  editorial stat callouts, and author headshots are deliberately un-invented
  placeholders.

---

## Known issues
- **9 cards merged on duplicate derived slugs** (368 source records → 359 rows).
  Two cards whose names slugify identically collide on the unique `slug`; the
  second upsert overwrites the first. A follow-up should disambiguate the slug
  (e.g. append network/variant) and re-import.
- **`overall_score` is null** for imported cards — editorial `card_ratings` are
  not part of the import (they come from the editorial workflow). Cards fall back
  to `editorial_score_5` where shown.
- **Authors / articles / change-log** remain seed-backed until real editorial
  content is added (expected; these aren't part of the card import).
- **`point_valuations` are estimates** and need editorial sign-off before the
  recommendation/best-card ₹-values are treated as authoritative.
