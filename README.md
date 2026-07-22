# CardCompare.in

> India's independent credit card comparison platform — find the right credit card, without the sales pitch.

CardCompare.in helps Indian consumers compare 350+ credit cards across 20+ banks with transparent editorial ratings, personalised recommendations, and fee-waiver tracking — all powered by data, not affiliate incentives.

**Live site:** SOON

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Card Reviews** | Detailed reviews with 5-dimension editorial ratings (rewards, fees, welcome benefit, flexibility, issuer service) |
| **Smart Recommender** | 8-question wizard that scores and ranks cards based on spend profile, income, CIBIL, and goals |
| **Combo Optimizer** | Finds the best 2–3 card combination for your spending pattern across categories |
| **Best Card Calculator** | "Which card should I use for this purchase?" — instant per-transaction advice |
| **Compare Tool** | Side-by-side comparison of up to 3 cards, plus curated `[a]-vs-[b]` pages |
| **Change Tracker** | Monitors fee increases, reward devaluations, and benefit changes across the market |
| **CIBIL Score Hub** | Band-based card recommendations (750+, 700–749, 650–699, below 650) |
| **My Wallet** | Auth-gated personal tracker for fee-waiver progress and card management |
| **Full-Text Search** | Weighted search across cards and editorial articles with offline fallback |
| **Guides & News** | Editorial guides, category roundups, and industry news articles |
| **Author Profiles** | Editorial team pages with expertise tags and review board flags |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Astro 5](https://astro.build/) (hybrid SSG + SSR) |
| **Interactive Islands** | [React 19](https://react.dev/) (6 client-side islands) |
| **Backend** | [Supabase](https://supabase.com/) (Postgres, Auth, Edge Functions, Storage) |
| **Styling** | Custom CSS design tokens (no Tailwind, no UI library) — 200 lines of tokens, 237 lines of globals |
| **Email** | [Resend](https://resend.com/) (change alerts, fee-waiver reminders) |
| **Enrichment** | Deterministic parser (reward categories/bonuses/offers from source JSON — no external API, no LLM) |
| **Hosting** | Static deploy with Node SSR adapter for `/wallet` (swappable to Vercel/Netlify) |
| **TypeScript** | Strict mode with path aliases (`@/*`, `@lib/*`, `@components/*`, `@islands/*`, `@layouts/*`) |

---

## 📋 Prerequisites

- **Node.js** ≥ 22.12.0
- **npm** ≥ 9
- A **Supabase** project ([supabase.com](https://supabase.com))
- *(Optional)* Resend API key for email features

---

## 🚀 Getting Started

### 1. Clone & install

```bash
git clone https://github.com/<your-org>/ccIndia.com.git
cd ccIndia.com
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
# Client-safe (exposed to browser via Astro PUBLIC_ prefix)
PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon-public-key>

# Server-only (Edge Functions + import scripts)
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Optional
RESEND_API_KEY=
DEPLOY_HOOK_URL=
```

> **Where to find keys:** Supabase Dashboard → **Settings → API** → Project URL + API Keys.

### 3. Set up the database

> 📘 **Full walkthrough:** [`SUPABASE_GUIDE.md`](./SUPABASE_GUIDE.md) covers project
> creation, migrations, seeding, import, RLS verification, and a "no cards showing"
> troubleshooting checklist. For how the system fits together, see
> [`architecture.md`](./architecture.md).

Run the 7 migration files **in order** in the Supabase SQL Editor:

| # | File | What it creates |
|---|---|---|
| 1 | `supabase/migrations/20260703000001_catalog.sql` | Core card catalog (11 tables) |
| 2 | `supabase/migrations/20260703000002_editorial.sql` | Authors, ratings, articles, point valuations |
| 3 | `supabase/migrations/20260703000003_user_wallet.sql` | User profiles, wallet, analytics |
| 4 | `supabase/migrations/20260703000004_views.sql` | `card_listing_view`, `wallet_summary_view` |
| 5 | `supabase/migrations/20260703000005_search.sql` | Full-text search (tsvector + `search_site` RPC) |
| 6 | `supabase/migrations/20260703000006_storage.sql` | Storage buckets (`card-images`, `author-headshots`) |
| 7 | `supabase/migrations/20260703000007_data_quality.sql` | `data_quality_flags` view |

Then seed reference data:

```sql
-- Run in SQL Editor after migrations
-- 1. Content categories (12 categories)
-- Paste contents of: supabase/seed/categories.sql

-- 2. Point valuations (22 bank-specific + 3 fallback)
-- Paste contents of: supabase/seed/point_valuations.sql
```

### 4. Import card data

```bash
# Dry-run first (no DB writes, prints parse coverage stats)
npx tsx scripts/import-cards.ts --dry-run

# Live import (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
npx tsx scripts/import-cards.ts
```

### 5. Enrich reward data (deterministic — no external API)

Parses reward categories, bonuses, and offers straight from the source JSON.

```bash
# Dry-run (prints a parsed sample, no writes)
npx tsx scripts/enrich-cards.ts --dry-run

# Live enrichment (requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
npx tsx scripts/enrich-cards.ts
```

### 6. Start development

```bash
npm run dev
```

The site runs at `http://localhost:4321`.

> **No Supabase? No problem.** The data layer has a built-in seed-data fallback — the site builds and runs with hand-crafted sample data (12 cards, 6 banks) when Supabase environment variables are not set. A `warnOnce()` log tells you exactly why and how to switch to live data.

---

## 📁 Project Structure

```
ccIndia.com/
├── public/                      Static assets
│   ├── card-img/                368 card art PNGs
│   ├── favicon.svg
│   ├── og-default.png           Default Open Graph image
│   └── robots.txt
├── src/
│   ├── components/              17 Astro components (zero JS)
│   │   ├── GlobalHeader.astro   Sticky nav with mega-menu & mobile drawer
│   │   ├── CardRow.astro        Core card display with expandable detail
│   │   ├── ComparisonTable.astro  Semantic table (cards + listing variants)
│   │   ├── FilterSortBar.astro  Client-side filter via data-* attributes
│   │   ├── RatingWidget.astro   Editorial rating with sub-score breakdown
│   │   ├── CategoryPillStrip.astro  Horizontal scrolling category pills
│   │   ├── Button.astro         Polymorphic <a>/<button>, 4 variants
│   │   ├── StickyApplyBanner.astro  Bottom sticky CTA on reviews
│   │   ├── OnThisPage.astro     Table-of-contents sidebar nav
│   │   ├── NewsletterForm.astro Email subscribe → Supabase
│   │   ├── Breadcrumbs.astro, AuthorByline.astro, ProsConsBlock.astro,
│   │   │   ScoreTierBadge.astro, AffiliateDisclosure.astro,
│   │   │   AsSeenOnStrip.astro, SiteFooter.astro
│   │   └── ...
│   ├── islands/                 6 React interactive islands
│   │   ├── RecommendWizard.tsx  8-question recommendation quiz
│   │   ├── ComboOptimizer.tsx   Best card combo finder
│   │   ├── CompareTool.tsx      Side-by-side comparison
│   │   ├── BestCardCalculator.tsx  Per-purchase card picker
│   │   ├── SearchBox.tsx        Full-text search + offline fallback
│   │   └── WalletDashboard.tsx  Auth-gated wallet tracker
│   ├── layouts/                 3 layouts (Base → Page → Article)
│   ├── lib/                     11 utility modules
│   │   ├── supabase.ts          Client factories (anon + service-role)
│   │   ├── queries.ts           Data access layer (Supabase ↔ seed fallback)
│   │   ├── edge-functions.ts    Typed Edge Function wrappers
│   │   ├── seo.ts               JSON-LD structured data builders
│   │   ├── format.ts            ₹ formatting with Indian digit grouping
│   │   ├── taxonomy.ts          Spend categories & input enums
│   │   ├── database.types.ts    Full DB schema TypeScript contracts
│   │   ├── seed-data.ts         Offline fallback dataset (12 cards, 6 banks)
│   │   ├── derive.ts            Data-driven fallback helpers (pros/cons/highlights)
│   │   ├── site.ts              Site config (name, domain, tagline)
│   │   └── tiers.ts             Qualitative badge tier mapping
│   ├── pages/                   27 page files
│   └── styles/                  Design token system
│       ├── tokens.css           200 lines — 80+ CSS custom properties
│       ├── global.css           237 lines — resets, typography, utilities
│       └── islands.css          99 lines — shared React island styles
├── scripts/
│   ├── import-cards.ts          Structured data import (368 cards)
│   ├── enrich-cards.ts          Deterministic reward/bonus/offer parsing (no API)
│   └── lib/parse.ts             Pure parsing library (620 lines, 25+ parsers)
├── supabase/
│   ├── migrations/              7 SQL migration files
│   ├── functions/               6 Edge Functions + shared lib
│   │   ├── recommend-cards/     Smart recommendation engine
│   │   ├── optimize-combo/      Combo optimizer
│   │   ├── best-card-for-purchase/  Per-transaction advisor
│   │   ├── detect-card-changes/ Weekly change detector
│   │   ├── send-change-alerts/  Email alerts for card changes
│   │   ├── send-fee-waiver-reminders/  Daily fee-waiver nudges
│   │   └── _shared/             Shared scoring, taxonomy, client utils
│   └── seed/                    Reference data (categories, point valuations)
├── bank-data/                   Source data (368 cards, Excel, images)
│   └── cc-data/
│       ├── Master-data-banks.json  585KB source JSON
│       ├── axisfinaldone18jun2026.xlsx
│       ├── convert_xlsx_to_json.py
│       └── card-img/            368 card art PNGs (source)
├── instructions/                Design & build specifications
│   ├── FRONTEND_PROMPT.md       Frontend design spec
│   ├── BACKEND_PROMPT.md        Backend & database spec
│   └── DESIGN (1).md            Full design system spec
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── CHANGELOG.md                 Full development history
├── SUPABASE_GUIDE.md            Database setup walkthrough
├── DESIGN-vercel.md             Vercel deployment design spec
└── architecture.md              Technical architecture guide
```

---

## 🗺 Route Map

| Route | Page | Mode | Description |
|---|---|---|---|
| `/` | `index.astro` | SSG | Homepage with featured cards, category pills, tools |
| `/cards/[bank]/[card]` | `cards/[bank]/[card].astro` | SSG | Individual card review (full detail, JSON-LD) |
| `/banks/[bank]` | `banks/[bank].astro` | SSG | Bank detail with all its cards |
| `/best/[category]` | `best/[category].astro` | SSG | Category card listing (e.g., /best/cashback) |
| `/cibil-score` | `cibil-score.astro` | SSG | CIBIL score hub with band-based recommendations |
| `/compare` | `compare/index.astro` | SSG | Side-by-side comparison tool |
| `/compare/[pair]` | `compare/[pair].astro` | SSG | Curated card vs card comparisons |
| `/recommend` | `recommend.astro` | SSG | Smart recommendation wizard (React island) |
| `/combo-optimizer` | `combo-optimizer.astro` | SSG | Best card combo finder (React island) |
| `/calculator/best-card` | `calculator/best-card.astro` | SSG | Per-purchase card picker (React island) |
| `/search` | `search.astro` | SSG | Full-text search (noindexed) |
| `/changes` | `changes.astro` | SSG | Card change history |
| `/guides` | `guides/index.astro` | SSG | All editorial guides |
| `/guides/[slug]` | `guides/[slug].astro` | SSG | Individual guide article |
| `/news` | `news/index.astro` | SSG | Industry news listing |
| `/news/[slug]` | `news/[slug].astro` | SSG | Individual news article |
| `/authors` | `authors/index.astro` | SSG | Editorial team listing |
| `/authors/[slug]` | `authors/[slug].astro` | SSG | Author profile page |
| `/wallet` | `wallet.astro` | **SSR** | Auth-gated personal wallet tracker |
| `/about` | `about.astro` | SSG | About CardCompare.in |
| `/contact` | `contact.astro` | SSG | Contact page |
| `/affiliate-disclosure` | `affiliate-disclosure.astro` | SSG | Affiliate disclosure |
| `/editorial-guidelines` | `editorial-guidelines.astro` | SSG | Editorial independence policy |
| `/privacy-policy` | `privacy-policy.astro` | SSG | Privacy policy |
| `/terms-of-use` | `terms-of-use.astro` | SSG | Terms of use |
| `/404` | `404.astro` | SSG | Not found error page |
| `/500` | `500.astro` | SSG | Server error page |

---

## 🧪 Development Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev server at `localhost:4321` |
| `npm run build` | Production build (static + SSR) |
| `npm run preview` | Preview production build locally |
| `npm run import:cards` | Import card data to Supabase |
| `npm run enrich:cards` | Parse reward categories/bonuses/offers from JSON (no API) |

---

## 🔐 Security Model

- **Row Level Security (RLS)** enabled on all 24 tables (~50 policies)
- **Public catalog:** Read-only for anonymous and authenticated users (13 tables)
- **User data:** Owner-scoped — users can only access their own wallet, spend logs, and reminders (`user_id = auth.uid()`)
- **Internal data:** `card_snapshots` and `data_quality_flags` are service-role only
- **Articles:** Only `is_published = true` articles are publicly visible
- **Analytics tables** (`newsletter_subscribers`, `card_click_events`): Insert-only, never client-readable
- **No PAN/Aadhaar** collected anywhere
- Service-role key is **never** exposed to the client (`typeof window` guard + Vite `define: {}` belt-and-braces)
- Email dedupe via `reminders_sent` with 14-day window prevents spam
- `.gitignore` excludes all `.env` files except `.env.example`

---

## 📊 Summary Statistics

| Metric | Count |
|---|---|
| **Page files** | 27 |
| **Astro Components** | 17 |
| **React Islands** | 6 |
| **Layouts** | 3 |
| **Lib modules** | 11 |
| **Edge Functions** | 6 (+ 3 shared utility files) |
| **Database Tables** | 24 |
| **Database Views** | 3 |
| **Storage Buckets** | 2 |
| **RLS Policies** | ~50 |
| **CSS Custom Properties** | 80+ |
| **Source Cards** | 368 |
| **Supported Banks** | 20+ |
| **Content Categories** | 12 |
| **Parser Functions** | 25+ (620 lines) |
| **Seed Fallback Cards** | 12 |

---

## 📄 Legal & Compliance

- **Affiliate disclosure** prominently displayed on every page with external apply links (dedicated `/affiliate-disclosure` page)
- **Editorial independence statement** in site footer and `/editorial-guidelines`
- **CIBIL/CIC disclaimer** — recommendations are rule-based estimates, not bureau soft-pulls
- Apply buttons always include "on [Issuer]'s secure site" microcopy
- External links use `rel="nofollow sponsored noopener"`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📜 License

This project is proprietary. All rights reserved.

---

<p align="center">
  Built with ❤️ for Indian credit card users who deserve better information.
</p>
