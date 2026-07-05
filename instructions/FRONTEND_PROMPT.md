# FRONTEND_PROMPT.md — CardCompare.in Frontend Build (Astro)

> Paste this entire file as your task prompt in Claude Code / Antigravity CLI. Keep it in the repo root — re-paste or re-reference it at the start of every new agent session so context doesn't drift between sessions or between the two CLIs you're switching between.

---

## 0. Role

You are a senior frontend engineer building the public website for **CardCompare.in** (working name — placeholder, not final branding), an independent credit-card comparison and review platform for the Indian market, structurally modeled on creditcards.com but redesigned for India. You will build this in **Astro**.

## 1. Required reading before writing any code

Read these files in full, in this order, before generating a single component:

1. `DESIGN.md` — the complete visual/UX/content design system. Every color, spacing value, component structure, and copy pattern in this build must come from that file, not from your own defaults or from copying creditcards.com's actual visual style. Where `DESIGN.md` marks something `[ESTIMATED]`, treat it as the working value unless the person running this session tells you otherwise.
2. `BACKEND_PROMPT.md` — the companion document defining the Supabase schema, RLS policies, and Edge Function contracts this frontend consumes. Table names, column names, and function contracts referenced below must match that document exactly. If it hasn't been built yet in this repo, build against the contracts as documented in `BACKEND_PROMPT.md` and flag any mismatch you find once the backend exists.

Do not invent schema, invent API shapes, or invent design tokens. If something is missing from both documents, stop and ask rather than guessing silently — this is a financial product and silent guesses about fees, rates, or eligibility text are the one category of mistake that actually damages user trust and site credibility.

## 2. Tech stack decisions (defaults — override if the person tells you otherwise)

- **Framework:** Astro, `output: 'hybrid'` (mix of prerendered static pages and on-demand server-rendered routes — see §5).
- **UI islands:** React via `@astrojs/react`, used only for interactive components (forms, calculators, the recommendation quiz, the wallet dashboard). Everything else is plain `.astro` components with zero client JS. If bundle size becomes a real problem later, swapping the React islands for Preact is a low-risk follow-up — don't pre-optimize for that now.
- **Styling:** Plain CSS with the exact custom properties from `DESIGN.md` §3, defined once in `src/styles/tokens.css` and imported globally. No Tailwind, no CSS-in-JS. This site's design system is already a token system — translating it into Tailwind's config would be a lossy extra step for no benefit here. Component styles live in `.astro` scoped `<style>` blocks or CSS Modules for React islands, always referencing `var(--token-name)`, never a hardcoded hex/px value.
- **Data access:** `@supabase/supabase-js`. Anon key for anything client-side and any build-time query that only needs public data (RLS enforces the read boundary). Service-role key only inside build scripts / Edge Functions, **never** shipped to the client bundle.
- **Deployment target:** Vercel or Netlify (both have mature Astro hybrid-rendering adapters and cheap/fast India-adjacent edge locations via their CDNs). Cloudflare Pages is a viable cheaper alternative if the person prefers it — the Astro code doesn't need to change meaningfully between these, just the adapter.
- **Content model split:** Card data (270+ structured records) lives in Supabase — see `BACKEND_PROMPT.md`. Long-form editorial content that *isn't* tied to a specific card's structured fields (guides, "best of" roundup prose, news articles) also lives in Supabase as DB rows (not Astro content collections / MDX files) so that both card reviews and guides can be authored/updated the same way (via the CMS/admin flow or direct DB writes) without redeploying via a content-collection rebuild. Prerendered pages still get rebuilt on a webhook when content changes (see §5).

## 3. The core design directive: minimal ≠ less information

You were told to make this "minimal like the reference site, not throw all info in the user's face." Read that correctly: creditcards.com's actual card-row component (`DESIGN.md` §6.3) is **information-dense** — reward tiers, at-a-glance stats, editor's take, pros/cons, an expandable full-details block. It reads as minimal not because it hides data, but because of strict visual hierarchy, generous whitespace, one dominant CTA, and **progressive disclosure**. For a financial comparison product, actually removing information would hurt trust, not help it — the fix for "too much on the page" is collapsing detail behind an explicit expand, not deleting it.

Apply this concretely:

- **Category listing pages** (`/best/[category]`): each card row shows, collapsed by default — eyebrow, card name, card art, our rating, ONE headline reward line ("5X points on travel"), a compact 4-stat "At A Glance" row (Annual Fee / Reward Rate / Min. CIBIL / Welcome Benefit), and the three actions (Apply Now / Add to Compare / Read full review). Everything else — full reward-category breakdown, full pros/cons, editor's take paragraph, highlights list, fee schedule table — sits behind a single **"Show full card details"** toggle, collapsed by default on both mobile and desktop.
- **Card review pages** (`/cards/[bank]/[card]`): show everything, in the full 22-step reading order from `DESIGN.md` §4 — this is the deep-dive context where density is expected and welcome.
- **Homepage:** stays close to empty by comparison-site standards — hero + "check my eligibility"-style CTA into the recommendation quiz, category pill strip, 3–5 featured card rows (collapsed state), 2–3 editorial teaser cards, trust block, newsletter band. No dashboards, no dense tables above the fold.

## 4. Full sitemap

```
/                                          Homepage
/best/[category-slug]                     Category listing (e.g. /best/cashback-credit-cards)
/cards/[bank-slug]/[card-slug]             Card review / detail page
/banks/[bank-slug]                         Issuer page — all cards from one bank
/compare                                   Compare tool (pick up to 3 cards)
/compare/[card-slug-a]-vs-[card-slug-b]    Pre-generated 2-card comparison (SEO)
/recommend                                 Card Recommendation Engine (5–8 question quiz)
/combo-optimizer                           Card Combo Optimizer
/calculator/best-card                      "Which card should I use for this purchase?" calculator
/wallet                                    My Wallet dashboard (auth required)
/changes                                   Card Change / Devaluation Tracker feed
/cibil-score                               CIBIL score range hub
/guides/[slug]                             Editorial guides
/news/[slug]                               News / RBI-update articles
/authors/[slug]                            Author bio pages
/search                                    Search results
/about, /editorial-guidelines,
/affiliate-disclosure, /privacy-policy,
/terms-of-use, /contact                    Static/legal pages
```

## 5. Rendering strategy per route

Astro `hybrid` output: default to `prerender = true`, override per-route.

| Route | Mode | Why |
|---|---|---|
| `/`, `/best/[category]`, `/cards/[bank]/[card]`, `/banks/[bank]`, `/compare/[a]-vs-[b]`, `/guides/*`, `/news/*`, `/authors/*`, static/legal | **Prerendered (SSG)** | This is the SEO-load-bearing content; must be static HTML, fast, crawlable. |
| `/recommend`, `/combo-optimizer`, `/calculator/best-card`, `/compare` (interactive picker), `/search` | **Prerendered shell + client-side React island** | Page chrome is static for fast paint; the interactive tool itself calls Supabase/Edge Functions client-side after hydration. |
| `/wallet` | **`prerender = false` (on-demand/SSR)** | Requires an authenticated session; must always be fresh, never cached publicly. |

**Rebuild-on-change:** because card data lives in Supabase, prerendered card/category pages go stale unless something triggers a rebuild. Set up a Supabase Database Webhook on `cards`, `card_reward_categories`, `card_bonuses`, `card_fees`, and `articles` tables that POSTs to your hosting provider's deploy hook on any insert/update. Don't rebuild on every single row edit during bulk import — batch: the import script (see `BACKEND_PROMPT.md` §7) should trigger exactly one rebuild at the end of a run, not one per row.

## 6. Design tokens setup

Create `src/styles/tokens.css` and transcribe **verbatim** the CSS custom properties from `DESIGN.md` §3.1–§3.7 (color system, type scale, spacing scale, radius, shadows, borders, motion durations). Import it once in the root layout. Do not modify any value — if a value needs to change, that's a design decision to raise with the person, not something to adjust silently while implementing.

Set `lang="en-IN"` on `<html>` in the root layout (`DESIGN.md` §7), not bare `en`.

## 7. Component inventory

Build these as reusable components, matching the structure/states/accessibility notes in the referenced `DESIGN.md` section. Don't restyle or simplify any of these — the spec in `DESIGN.md` already encodes real trust-UX reasoning (e.g. why Pros/Cons must be visually equal weight, why "Apply Now" must never be red, why ratings need a numeric primary + optional star secondary).

| Component | DESIGN.md ref | Notes |
|---|---|---|
| `GlobalHeader` | §6.1 | Horizontally-scrollable nav, mega-menu flyouts, mobile drawer/accordion |
| `CategoryPillStrip` | §6.2 | Real `<nav>` of `<a>` links, not ARIA tabs |
| `CardRow` | §6.3 | The core conversion unit — build the collapsed/expanded variants per §3 above |
| `RatingWidget` | §6.4 | Numeric primary, inline disclosure toggle, sub-score breakdown table on review pages |
| `Button` (Primary/Outline/Ghost/Tertiary) | §6.5 | One shared component, variant prop — never a one-off styled button anywhere else |
| `ComparisonTable` | §6.6 | Real semantic `<table>`; three structural variants per spec |
| `EligibilityQuizWizard` | §6.7, adapted — see §11.1 below | One-topic-per-screen wizard; **do not** implement the PAN/soft-pull steps from `DESIGN.md` §6.7 as written — see §11.1 for the actual v1 scope |
| `AuthorByline` / `AuthorCard` | §6.8 | Three-role byline never collapses to "Staff" |
| `ProsConsBlock` | §6.9 | Two-column, equal visual weight, never stacked as one mixed list |
| `StickyApplyBanner` | §6.10 | Dismissible, respects dismissal for the session via `sessionStorage` — this is a real production site, not a sandboxed artifact, so normal browser storage APIs are fine to use here |
| `SiteFooter` | §6.11 | Full disclosure blocks never omitted, never abbreviated |
| `AsSeenOnStrip` | §6.12 | Leave the logo list empty/commented with a `TODO: real press mentions only` marker — do not invent outlets |
| `NewsletterForm` | §6.13 | `aria-live="polite"` success state |
| `ScoreTierBadge` | §6.14 | Color + text label always together, never color alone |
| `FilterSortBar` | §6.15 | Real checkboxes/`<select>`s, not styled divs |
| `RecommendationResultCard` | New, §11.1 | Card result + score breakdown + plain-language reasons |
| `ComboResultCard` | New, §11.2 | Per-category assignment table + totals + redundancy warnings |
| `BestCardForPurchaseWidget` | New, §11.3 | Small embeddable widget, also usable inline on card review pages |
| `WalletCardTile` | New, §11.4 | Progress bar to fee-waiver threshold, milestone proximity, renewal countdown |
| `ChangeLogFeedItem` | New, §11.5 | Dated, diffed old→new value display |

## 8. Page-by-page specs

**Homepage (`/`):** Hero with one-line value prop + primary CTA into `/recommend`. Category pill strip. 3–5 featured `CardRow` components (collapsed). "How it works" 3-step explainer (quiz → compare → apply). Editorial teaser grid (guides/news, same teaser template per `DESIGN.md` §2 principle 7). "Why trust us" trust block (§6.8, real stat callouts only, no placeholder numbers). `AsSeenOnStrip`. `NewsletterForm`. `SiteFooter`.

**Category listing (`/best/[category]`):** Breadcrumb. H1 ("Best {Category} Credit Cards of {Month Year}" — must actually reflect current month; regenerate/rebuild monthly). `FilterSortBar`. Summary comparison table (§6.6 variant 3) above the fold. Full-list of `CardRow`s (collapsed), one per card in that category, ordered by the sort control (default: Featured/editorial order, sourced from `card_categories.is_primary` + `card_ratings.overall_score`). "How we picked" methodology section. FAQ block. Standard footer stack.

**Card review (`/cards/[bank]/[card]`):** Follow the exact 22-step reading order in `DESIGN.md` §4 verbatim. Pull structured fields from the `cards`/`card_*` tables (see §10 below); long-form prose sections ("Why you might want this card," "Who should get this card," verdict) come from the `articles` table row linked to this card (`articles.related_card_id`), authored content, not auto-generated from raw fields.

**Compare (`/compare` and `/compare/[a]-vs-[b]`):** Card-image-header comparison table, up to 3 columns. `/compare` is the interactive picker (search/add up to 3 cards, React island). `/compare/[a]-vs-[b]` routes are prerendered for the highest-traffic pairs (generate `getStaticPaths` from a curated list — e.g. top cards within each category compared pairwise — not all 270×270 permutations).

**Bank/issuer (`/banks/[bank-slug]`):** Bank logo/about blurb, "issued by a Scheduled Commercial Bank regulated by the RBI" trust line where true (`DESIGN.md` §10.4), full card list from that issuer using the same collapsed `CardRow`.

**Recommendation engine (`/recommend`):** See §11.1.

**Combo optimizer (`/combo-optimizer`):** See §11.2.

**Best-card calculator (`/calculator/best-card`):** See §11.3.

**Wallet (`/wallet`, auth required):** See §11.4. Redirect to a sign-in screen (Supabase Auth) if unauthenticated; don't build a separate marketing page for this route, just gate it.

**Changes feed (`/changes`):** See §11.5.

**CIBIL score hub (`/cibil-score`):** Explainer content on CIBIL/CIC scoring (`DESIGN.md` §10.2), band-based card recommendations linking into `/best/[category]?cibil=750-plus` style filtered views, link to the recommendation engine.

**Guides / News / Authors:** Standard long-form article template, "On this page" anchor nav for content over ~1,200 words (a `<select>`-based "Jump to" on mobile per `DESIGN.md` §5), FAQ close-out where relevant.

**Search (`/search?q=`):** Calls the Postgres full-text search RPC defined in `BACKEND_PROMPT.md` §12, unions card + article results, card results render as compact `CardRow` variants, article results as teaser cards.

## 9. SEO requirements

- One `<h1>` per page, correct heading nesting, semantic `<main>`/`<nav>`/breadcrumb landmarks per `DESIGN.md` §7.
- `astro-sitemap` integration, generate on every build.
- JSON-LD structured data: `Product`/`FinancialProduct`-appropriate markup on card review pages (name, image, issuer as `brand`, aggregate rating if `card_ratings` populated); `FAQPage` schema on any page with an FAQ block; `BreadcrumbList` on every non-home page; `Article` schema on guides/news with author.
- Unique, keyword-first `<title>` and meta description per page, generated from real fields (card name + bank + "Review", category + month/year for "Best of" pages) — never a generic template string repeated across pages.
- `og:image` per page — card art for reviews, a generated/default share image for others.
- Canonical URLs on every page, including the pre-generated compare pairs (avoid `a-vs-b` and `b-vs-a` existing as separate indexable pages — pick one canonical order and 301/redirect or canonical-tag the other if both routes are reachable).
- "Best of" category pages must actually update monthly (title says "of July 2026" — make this true, not decorative: rebuild trigger + `updated_at` byline date must move together).

## 10. Data contracts (what each page queries)

Match table/column names in `BACKEND_PROMPT.md` §5 exactly. Representative examples:

- `CardRow` / card review page: `cards` joined to `banks`, `card_categories`→`categories`, `card_reward_categories`, `card_bonuses`, `card_fees`, `card_eligibility`, `card_ratings`.
- Category listing sort/filter: query against a Postgres **view** `card_listing_view` (define this view in the backend, don't reconstruct the joins in every page query) that flattens the fields a listing page needs, indexed for the filter/sort columns (`annual_fee_amount`, `cibil_min`, `overall_score`).
- Recommendation engine / combo optimizer / best-card calculator: **do not** query tables directly from the frontend for these — call the Edge Functions defined in `BACKEND_PROMPT.md` §9 (`recommend-cards`, `optimize-combo`, `best-card-for-purchase`). Keep the scoring/optimization logic server-side only; don't duplicate it in a client-side JS reimplementation, or the two will drift.
- Wallet dashboard: `user_wallet_cards` joined to `cards`, RLS-scoped to `auth.uid()`, plus `wallet_spend_log` for the spend-progress bars.
- Changes feed: `card_change_log` joined to `cards`/`banks`, paginated, filterable by category.

## 11. Unique feature UX specs

These are the site's actual USP over BankBazaar/Paisabazaar/CreditCards.com. Build the UX carefully — the differentiation is real only if these feel trustworthy and are transparent about being estimates, not just "extra widgets."

### 11.1 Card Recommendation Engine (`/recommend`)

This **replaces** `DESIGN.md`'s CardMatch-equivalent eligibility checker rather than sitting alongside it as a second form. Reasoning: the reference site's flow (§6.7) exists to power a real bureau soft-pull integration that returns bank-verified approval odds — this build has no such partner in v1. Building a second PAN-collecting form that *implies* a real soft-pull, without one behind it, is exactly the kind of vague/overstated trust claim `DESIGN.md` §10.5 explicitly warns against. So: one flow, clearly framed as an **estimate**, no PAN collection in v1.

**Flow — 8 questions, one per screen, `EligibilityQuizWizard`, Back/Next persistent per `DESIGN.md` §6.7 structural pattern:**

1. Primary goal (single-select): Cashback / Travel & Miles / Rewards Points / Fuel Savings / My first credit card / Business expenses / Airport lounge access
2. Typical monthly card spend (single-select bands): <₹20k / ₹20k–50k / ₹50k–1L / ₹1L–3L / ₹3L+
3. Top 1–2 spend categories (multi-select, max 2): Groceries & online shopping / Dining / Flights & travel / Fuel / Utility bills / Large purchases (EMI)
4. Air travel frequency (single-select): Never / 1–2×/year / 3–6×/year / 7+/year
5. Employment type (single-select): Salaried / Self-employed / Student / Not currently employed
6. Annual income band (single-select): <₹3L / ₹3–6L / ₹6–12L / ₹12–25L / ₹25L+
7. Your best estimate of your CIBIL score (single-select): 750+ (Excellent) / 700–749 (Good) / 650–699 (Fair) / New to credit / Not sure
8. Fee preference (single-select): Prefer lifetime-free only / Okay with a fee if the value is clearly worth it / No preference

No PAN. No name/address/mobile collection required to see results (optionally offer "email me these results" as a soft, skippable capture at the results screen — that's the newsletter/lead-capture moment, kept separate from the quiz itself).

**Results screen:** call `recommend-cards` (contract in `BACKEND_PROMPT.md` §9.1). Show top 3 ranked `RecommendationResultCard`s, each with: card art, total score, 2–3 plain-language reason bullets generated from the highest-weighted subscores (not a raw score dump), estimated annual value in ₹, fee-waiver note if relevant. Below that: one "stretch pick" (premium card, clearly labeled "if you want to spend more") and one "safe pick" (lifetime-free, clearly labeled "zero ongoing cost"). Every card in results links straight to its full review and has an "Apply Now" CTA.

**Trust copy, verbatim placement matters:** directly above the results, one sentence: *"These are estimates based on your answers and each issuer's published eligibility criteria — not a bureau-verified check. Actual approval depends on the issuer's own review of your application."* This is the honest v1 replacement for `DESIGN.md`'s soft-inquiry copy; don't borrow that copy verbatim since it describes a mechanism (an actual soft pull) this build doesn't implement yet.

### 11.2 Card Combo Optimizer (`/combo-optimizer`)

**Input UI:** either (a) pull category spend automatically from the user's `/recommend` session if they just came from there, or (b) a fresh input form: sliders/number inputs per spend category (same category taxonomy as the quiz, see `BACKEND_PROMPT.md` §4), a max-cards toggle (2 or 3), and an optional max total annual fee budget. Reuse the eligibility fields from §11.1 if not already known this session.

**Output:** call `optimize-combo` (contract in `BACKEND_PROMPT.md` §9.2). Render the winning combo as: the N cards side by side, a per-category "use this card for X" assignment table (this is the payoff visualization — make it the visual centerpiece, e.g. a simple table: Category | Amount | Best Card | Est. Monthly Value), total annual reward value, total annual fees (net of waivers), net value, and any redundancy warnings ("Both cards offer overlapping airport lounge access — consider dropping one"). Show one alternate combo below the primary recommendation for comparison.

**Explicit framing copy:** state plainly that this is a heuristic estimate based on published reward rates, not a guarantee, and that actual redemption value varies by how points/miles are redeemed.

### 11.3 "Which card should I use for this?" calculator (`/calculator/best-card` + embeddable widget on review pages)

Inputs: spend category (dropdown) + amount (₹). If the user is signed in with wallet cards, defaults to comparing their wallet; otherwise a simple picker to add up to 6 cards. Calls `best-card-for-purchase` (contract in `BACKEND_PROMPT.md` §9.3). Output: ranked list, each row showing estimated ₹ value earned, with a visible caveat that redemption value varies by channel (statement credit vs flight transfer vs voucher), and a milestone-proximity nudge where relevant ("You're ₹4,200 away from this card's next milestone bonus").

### 11.4 My Wallet — fee-waiver / milestone tracker + lounge aggregator (`/wallet`, auth required)

Auth via Supabase Auth (see `BACKEND_PROMPT.md` §10). User adds owned cards from the catalog (search/select, not free text), optionally sets card-opened date / billing cycle day. Each `WalletCardTile` shows: a progress bar toward `annual_fee_waiver_spend_amount` (spend logged manually via a simple "add spend" input — no bank-statement integration in v1, see roadmap note below), days remaining in the current fee-waiver measurement period, proximity to any milestone bonus from `card_bonuses`. Dashboard header aggregates: total annual fees across the wallet, combined domestic + international lounge visits per year across all wallet cards (dedupe shared-network cards — e.g. two cards on the same Priority Pass membership shouldn't double-count), and a simple upcoming-renewals timeline.

**Roadmap note to include in the UI as a small, honest disclosure, not to build now:** "Spend tracking here is manual. We're evaluating RBI Account Aggregator (AA) framework integration for automatic, consent-based spend tracking in a future update" — don't build AA integration in v1, it's a real compliance/partner-integration project, not a frontend task.

### 11.5 Card Change / Devaluation Tracker (`/changes` + inline callout on every review)

Feed page: paginated, filterable-by-category list of `ChangeLogFeedItem`s pulled from `card_change_log`, most recent first, each showing card name, what changed (old → new), and detected date. On every card review page, surface a small dated **"Recent changes to this card"** callout near the top (per `DESIGN.md` §9) if there's a `card_change_log` row for that card in, say, the last 6 months — collapse/omit the callout entirely if there's nothing recent, don't show an empty state box.

### Roadmap — flagged, not v1 scope

Mention these exist as a stated roadmap (e.g. in an `/about` "what's next" note or just internal comment) but do not build them now: **community-sourced approval reports** (crowd-sourced "I was approved/rejected at CIBIL band X" data to refine real-world odds — needs moderation/anti-spam design before it's trustworthy), **EMI-vs-rewards payoff calculator**, **Account-Aggregator-based automatic spend tracking** for the wallet.

## 12. Performance budget

- Largest Contentful Paint target: <2.5s on a simulated mid-range Android + 4G profile (this is the realistic primary user per `DESIGN.md` §2 principle 10 — test against it, not against a desktop/fiber profile).
- Ship zero JS by default on prerendered pages; React islands only where interaction is actually required (`client:visible` preferred over `client:load` for below-the-fold islands like embedded calculators).
- Card art: responsive `srcset`, WebP/AVIF with fallback, fixed 1.59:1 aspect-ratio container to avoid layout shift (`DESIGN.md` §5).
- No render-blocking web fonts beyond the primary sans stack in `DESIGN.md` §3.2; `font-display: swap`.

## 13. Accessibility (mandatory, not optional polish)

Everything in `DESIGN.md` §7 applies without exception: visible `:focus-visible` rings sitewide, full keyboard operability on all mega-menus/accordions/popovers/the quiz wizard, 44×44px minimum touch targets, real `<table>` markup for every comparison table, `aria-live="polite"` on async result regions (recommendation results, newsletter success, combo optimizer output), color never used alone to convey a rating tier, `lang="en-IN"` root attribute.

## 14. Suggested folder structure

```
src/
  layouts/          BaseLayout.astro, ArticleLayout.astro
  components/        (per §7 inventory — .astro for static, .tsx for islands)
  islands/           React components requiring client hydration
  pages/             routes per §4 sitemap
  styles/tokens.css
  lib/supabase.ts    typed client, anon + (server-only) service-role instances
  lib/edge-functions.ts  typed wrappers for recommend-cards / optimize-combo / best-card-for-purchase
public/
```

## 15. Build order

1. Design tokens + base layout + header/footer + homepage shell (static, no data).
2. Card review page template + category listing template, wired to real Supabase data for a handful of seeded cards.
3. Compare tool.
4. Recommendation engine (§11.1) end-to-end against the `recommend-cards` Edge Function.
5. Combo optimizer (§11.2), best-card calculator (§11.3).
6. Auth + Wallet dashboard (§11.4).
7. Changes feed (§11.5).
8. Guides/news/authors/search/legal pages.
9. SEO pass (structured data, sitemap, meta) + performance pass + accessibility audit.

## 16. Explicit don'ts

- Don't invent press-mention logos, editorial stat callouts, or author headshots — leave clearly marked placeholders (`DESIGN.md` §11).
- Don't collect PAN or Aadhaar anywhere in v1 (see §11.1 reasoning).
- Don't reimplement recommendation/combo-optimizer scoring logic client-side "for speed" — call the Edge Functions.
- Don't ship a card-row listing page with everything expanded by default — see §3.
- Don't use a hover-only mega-menu with no keyboard/touch equivalent.
- Don't use `localStorage`/`sessionStorage` for anything that should survive across devices (wallet data belongs in Supabase, scoped to the user) — session-only UI state (banner dismissal) is the only appropriate use.

## 17. Definition of done (per page/component)

Run the full checklist in `DESIGN.md` §12 before considering any page template finished, plus: real data from Supabase (not lorem ipsum) rendering correctly for at least 5 different cards across at least 3 different banks, mobile viewport tested first, Lighthouse SEO + accessibility scores both ≥95 on the card review and category listing templates specifically (these carry the most organic-search weight).
