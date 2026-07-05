# CardCompare.in

> India's independent credit card comparison platform — find the right credit card, without the sales pitch.

CardCompare.in helps Indian consumers compare 350+ credit cards across 20+ banks with transparent editorial ratings, personalised recommendations, and fee-waiver tracking — all powered by data, not affiliate incentives.

**Live site:** [https://cardcompare.in](https://cardcompare.in)

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Card Reviews** | Detailed reviews with 5-dimension editorial ratings (rewards, fees, welcome benefit, flexibility, issuer service) |
| **Smart Recommender** | 8-question wizard that scores and ranks cards based on spend profile, income, CIBIL, and goals |
| **Combo Optimizer** | Finds the best 2–3 card combination for your spending pattern across categories |
| **Best Card Calculator** | "Which card should I use for this purchase?" — instant per-transaction advice |
| **Compare Tool** | Side-by-side comparison of up to 3 cards |
| **Change Tracker** | Monitors fee increases, reward devaluations, and benefit changes across the market |
| **CIBIL Score Hub** | Band-based card recommendations (750+, 700–749, etc.) |
| **My Wallet** | Auth-gated personal tracker for fee-waiver progress and card management |
| **Full-Text Search** | Weighted search across cards and editorial articles |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Astro 5](https://astro.build/) (hybrid SSG + SSR) |
| **Interactive Islands** | [React 19](https://react.dev/) (6 client-side islands) |
| **Backend** | [Supabase](https://supabase.com/) (Postgres, Auth, Edge Functions, Storage) |
| **Styling** | Custom CSS design tokens (no Tailwind, no UI library) |
| **Email** | [Resend](https://resend.com/) (change alerts, fee-waiver reminders) |
| **Enrichment** | Deterministic parser (reward categories/bonuses/offers from the source JSON — no external API) |
| **Hosting** | Static deploy with Node SSR adapter for `/wallet` |

---

## 📋 Prerequisites

- **Node.js** ≥ 18
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
> [`ARCHITECTURE.md`](./ARCHITECTURE.md).

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

> **No Supabase? No problem.** The data layer has a built-in seed-data fallback — the site builds and runs with hand-crafted sample data when Supabase environment variables are not set.

---

## 📁 Project Structure

```
ccIndia.com/
├── public/                      Static assets (card images, favicon, OG image)
│   └── card-img/                Card art PNGs
├── src/
│   ├── components/              16 Astro components (CardRow, GlobalHeader, etc.)
│   ├── islands/                 6 React interactive islands
│   │   ├── RecommendWizard.tsx  8-question recommendation quiz
│   │   ├── ComboOptimizer.tsx   Best card combo finder
│   │   ├── CompareTool.tsx      Side-by-side comparison
│   │   ├── BestCardCalculator.tsx  Per-purchase card picker
│   │   ├── SearchBox.tsx        Full-text search
│   │   └── WalletDashboard.tsx  Auth-gated wallet tracker
│   ├── layouts/                 3 layouts (Base → Page → Article)
│   ├── lib/                     11 utility modules
│   │   ├── supabase.ts          Client factories (anon + service-role)
│   │   ├── queries.ts           Data access layer (Supabase ↔ seed fallback)
│   │   ├── edge-functions.ts    Typed Edge Function wrappers
│   │   ├── seo.ts               JSON-LD structured data builders
│   │   ├── format.ts            ₹ formatting with Indian digit grouping
│   │   ├── taxonomy.ts          Spend categories & input enums
│   │   └── ...
│   ├── pages/                   25+ routes (SSG + 1 SSR)
│   └── styles/                  Design token system
│       ├── tokens.css           80+ CSS custom properties
│       ├── global.css           Resets & utilities
│       └── islands.css          Shared React island styles
├── scripts/
│   ├── import-cards.ts          Structured data import (368 cards)
│   ├── enrich-cards.ts          Deterministic reward/bonus/offer parsing (no API)
│   └── lib/parse.ts             Pure parsing library (25+ parsers)
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
├── instructions/                Design & build specifications
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

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

- **Row Level Security (RLS)** enabled on all 24 tables
- **Public catalog:** Read-only for anonymous and authenticated users
- **User data:** Owner-scoped — users can only access their own wallet, spend logs, and reminders
- **Internal data:** `card_snapshots` and `data_quality_flags` are service-role only
- **Articles:** Only `is_published = true` articles are publicly visible
- **Analytics tables** (`newsletter_subscribers`, `card_click_events`): Insert-only, never client-readable
- **No PAN/Aadhaar** collected anywhere
- Service-role key is **never** exposed to the client

---

## 📄 Legal & Compliance

- **Affiliate disclosure** prominently displayed on every page with external apply links
- **Editorial independence statement** in site footer
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
