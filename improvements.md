# Improvements & Roadmap

> Last updated: **25 July 2026**
>
> Actionable improvement plan for CardCompare.in, derived from a full codebase
> audit and skills-ecosystem scan. Items are grouped by domain, prioritised by
> impact, and annotated with recommended agent skills where available.

---

## Table of Contents

- [1. Performance Optimizations](#1-performance-optimizations)
- [2. SEO & Structured Data](#2-seo--structured-data)
- [3. Accessibility (a11y)](#3-accessibility-a11y)
- [4. Testing & Quality](#4-testing--quality)
- [5. Security Hardening](#5-security-hardening)
- [6. CI/CD & DevOps](#6-cicd--devops)
- [7. New Features](#7-new-features)
- [8. Code Quality & DX](#8-code-quality--dx)
- [9. Recommended Agent Skills](#9-recommended-agent-skills)

---

## 1. Performance Optimizations

### 🔴 Critical

| # | Improvement | Details | File(s) |
|---|---|---|---|
| 1.1 | **Image optimization pipeline** | Card images (`image_url`) are rendered as plain `<img>`. Switch to Astro's `<Image />` component for automatic WebP/AVIF conversion, responsive `srcset`, and lazy loading. | `src/components/CardImage.astro`, all card pages |
| 1.2 | **Font loading strategy** | Google Fonts are loaded via `<link>` with no `font-display: swap` or preload hints, causing FOIT (flash of invisible text). Add `<link rel="preload">` for critical fonts and use `font-display: optional` or `swap`. | `src/layouts/BaseLayout.astro` |
| 1.3 | **Bundle analysis** | No bundle analysis tooling exists. Add `rollup-plugin-visualizer` to identify oversized chunks in the Vite build. | `astro.config.mjs` |

### 🟡 Important

| # | Improvement | Details | File(s) |
|---|---|---|---|
| 1.4 | **Lazy load React islands** | React islands (`client:load`) hydrate immediately. Switch non-critical islands to `client:visible` or `client:idle` to defer hydration until needed. | `src/islands/BestCardCalculator.tsx`, `src/islands/RecommendQuiz.tsx` |
| 1.5 | **CSS code-splitting** | All 637 lines of CSS load on every page. Split `global.css` into a critical above-the-fold subset inlined in `<head>` and a deferred remainder. | `src/styles/global.css` |
| 1.6 | **Prefetch links** | Add `<link rel="prefetch">` for high-probability next navigations (e.g., card → bank, compare → card). Astro's built-in prefetch integration can handle this. | `astro.config.mjs` |
| 1.7 | **Edge-side caching headers** | Add `Cache-Control` / `CDN-Cache-Control` headers for static pages (immutable for hashed assets, `s-maxage` for HTML). | Deployment config |

### 🟢 Nice to Have

| # | Improvement | Details |
|---|---|---|
| 1.8 | **Service Worker for offline** | Add a basic service worker to cache the app shell and card list for offline browsing (see PWA in §7). |
| 1.9 | **HTTP/2 server push** | Push critical CSS and font files on initial navigation for faster first paint. |

---

## 2. SEO & Structured Data

### 🔴 Critical

| # | Improvement | Details | File(s) |
|---|---|---|---|
| 2.1 | **Open Graph & Twitter Card meta tags** | `BaseLayout.astro` has `<title>` and `<meta name="description">` but is missing `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card`, `twitter:title`, `twitter:description`. Every page shared on social media currently shows no preview. | `src/layouts/BaseLayout.astro` |
| 2.2 | **Canonical URL on every page** | No `<link rel="canonical">` is emitted. This risks duplicate-content penalties from trailing slashes, www vs non-www, and query params. | `src/layouts/BaseLayout.astro` |
| 2.3 | **robots.txt `Sitemap:` directive** | `public/robots.txt` exists but doesn't include `Sitemap: https://cardcompare.in/sitemap-index.xml` to help crawlers discover the sitemap. | `public/robots.txt` |

### 🟡 Important

| # | Improvement | Details |
|---|---|---|
| 2.4 | **Rich FAQ schema on category pages** | `/best/[slug]` pages already have FAQ-like content but don't emit `FAQPage` structured data. Adding this could earn rich snippets in Google search. |
| 2.5 | **Product review schema** | Card review pages could add `Review` schema alongside the existing `FinancialProduct` to earn star ratings in SERPs. |
| 2.6 | **Breadcrumb schema completeness** | Verify every page emits `BreadcrumbList` JSON-LD (currently only some page types do). |
| 2.7 | **Hreflang tags** | If an Hindi version is planned, add `hreflang="hi-IN"` alternates now to future-proof. |

---

## 3. Accessibility (a11y)

### 🔴 Critical

| # | Improvement | Details | File(s) |
|---|---|---|---|
| 3.1 | **Keyboard navigation for comparison table** | The `/compare` interactive table lacks visible focus indicators and ARIA roles (`role="grid"`, `aria-sort`). | `src/components/CompareTable.astro` |
| 3.2 | **Form labels in quiz island** | The `RecommendQuiz.tsx` island uses styled `<div>` elements as selectable options. These need `role="radio"`, `aria-checked`, and keyboard arrow-key navigation. | `src/islands/RecommendQuiz.tsx` |
| 3.3 | **Color contrast audit** | Several tier badge colors (e.g., `--color-tier-fair` on white) may not meet WCAG AA 4.5:1 contrast ratio. Run a systematic audit. | `src/styles/tokens.css` |

### 🟡 Important

| # | Improvement | Details |
|---|---|---|
| 3.4 | **Skip-to-content link** | Add a visually hidden "Skip to main content" link for screen-reader users. |
| 3.5 | **Alt text for card images** | `CardImage.astro` uses the card name as alt text — verify it's descriptive enough (e.g., "HDFC Regalia Gold Credit Card image"). |
| 3.6 | **`aria-live` for dynamic results** | The calculator and quiz islands update results dynamically. Add `aria-live="polite"` regions so screen readers announce updates. |
| 3.7 | **Reduced motion respect** | Add `@media (prefers-reduced-motion: reduce)` to disable animations for users who prefer reduced motion. |

---

## 4. Testing & Quality

### Current State
- ✅ **207 unit tests** across 6 files (format, parse, taxonomy, SEO, tiers, best-card-engine)
- ❌ **No component tests** (Astro components, React islands)
- ❌ **No E2E tests** (page rendering, navigation, interactive flows)
- ❌ **No edge function tests** (Supabase Functions under `supabase/functions/`)
- ❌ **No visual regression tests**

### 🔴 Critical

| # | Improvement | Details |
|---|---|---|
| 4.1 | **E2E test suite with Playwright** | Add Playwright tests for critical user journeys: homepage → card page → compare, quiz flow, calculator flow, search. |
| 4.2 | **Edge Function unit tests** | The scoring/recommendation logic in `supabase/functions/_shared/` (scoring.ts, reward-math.ts) contains core business logic with zero test coverage. Port the same Vitest setup. |
| 4.3 | **Component smoke tests** | Add tests for key Astro components rendering correctly with mock data (CompareTable, CardGrid, ScoreTierBadge). |

### 🟡 Important

| # | Improvement | Details |
|---|---|---|
| 4.4 | **Visual regression testing** | Add Percy or Playwright screenshot comparison for card pages and the comparison table to catch CSS regressions. |
| 4.5 | **Coverage enforcement** | Add a minimum coverage threshold (70%+) and fail CI if coverage drops. Currently no coverage enforcement. |
| 4.6 | **Import/enrich script tests** | `scripts/import-cards.ts` and `scripts/enrich-cards.ts` are untested orchestration scripts. Add integration tests with fixture data. |

---

## 5. Security Hardening

### 🔴 Critical

| # | Improvement | Details | File(s) |
|---|---|---|---|
| 5.1 | **Content Security Policy (CSP)** | No CSP headers are set. Add a strict CSP that whitelists `self`, Google Fonts, and Supabase domains. This prevents XSS and data exfiltration. | Deployment config / middleware |
| 5.2 | **Supabase RLS audit** | Verify Row Level Security policies exist and are correct for all Supabase tables. The `SUPABASE_SERVICE_ROLE_KEY` is used in edge functions — ensure it's never exposed to the client. | `supabase/` |
| 5.3 | **Dependency audit** | `npm audit` currently reports **6 vulnerabilities** (1 low, 1 moderate, 4 high). Run `npm audit fix` and address remaining issues. | `package.json` |

### 🟡 Important

| # | Improvement | Details |
|---|---|---|
| 5.4 | **Security headers** | Add `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy` headers. |
| 5.5 | **Rate limiting on Edge Functions** | The recommendation and scoring edge functions have no rate limiting. Add Supabase's built-in rate limiting or a custom middleware. |
| 5.6 | **Subresource Integrity (SRI)** | Add `integrity` attributes to externally-loaded scripts and stylesheets (Google Fonts). |

---

## 6. CI/CD & DevOps

### Current State
- ❌ No `.github/workflows/` directory — no CI/CD pipeline exists
- ❌ No Dockerfile
- ❌ No deployment configuration (Vercel/Netlify/Cloudflare)

### 🔴 Critical

| # | Improvement | Details |
|---|---|---|
| 6.1 | **GitHub Actions CI pipeline** | Create a CI workflow that runs on every PR: lint (`astro check`), type-check, unit tests (`npm test`), build (`astro build`). |
| 6.2 | **Automated deployment** | Configure deployment to Vercel/Netlify/Cloudflare Pages with automatic preview deployments on PRs and production deployments on `main`. |
| 6.3 | **Supabase migration CI** | Add a workflow step that runs `supabase db diff` to detect migration drift and `supabase functions deploy` for edge function deployment. |

### 🟡 Important

| # | Improvement | Details |
|---|---|---|
| 6.4 | **Dependabot / Renovate** | Enable automated dependency updates with Dependabot or Renovate to catch security patches early. |
| 6.5 | **Pre-commit hooks** | Add Husky + lint-staged for pre-commit formatting and type-checking. |
| 6.6 | **Docker development environment** | Create a `docker-compose.yml` with local Supabase + the Astro dev server for reproducible dev environments. |

---

## 7. New Features

### 🔴 High Impact

| # | Feature | Details | Complexity |
|---|---|---|---|
| 7.1 | **Dark mode** | The design system uses CSS custom properties — add a `[data-theme="dark"]` variant with swapped colour tokens and a toggle in the header. The existing token architecture makes this straightforward. | Medium |
| 7.2 | **PWA support** | Add `manifest.json`, service worker, and offline card list caching. Indian users on flaky mobile connections would benefit greatly from offline support. | Medium |
| 7.3 | **Social sharing cards** | Auto-generate OG images for each card/bank/category page using Satori or `@vercel/og` so social shares display rich previews. | Medium |
| 7.4 | **Search with fuzzy matching** | The `/search` page currently has no implementation. Add client-side fuzzy search (Fuse.js) over the card index with instant results. | Low |

### 🟡 Medium Impact

| # | Feature | Details | Complexity |
|---|---|---|---|
| 7.5 | **Card comparison saved to URL** | Encode compared cards into the URL query params so comparisons are shareable and bookmarkable. | Low |
| 7.6 | **Email alerts / wallet notifications** | The `/wallet` page exists but has no notification system. Add email digests for annual-fee-due and offer-expiry reminders. | High |
| 7.7 | **Analytics integration** | Add privacy-respecting analytics (Plausible, Umami, or Fathom) to track user journeys and identify popular cards/flows. | Low |
| 7.8 | **i18n: Hindi language support** | Many Indian users prefer Hindi. Astro has built-in i18n. Add Hindi translations for UI strings. | High |

### 🟢 Nice to Have

| # | Feature | Details | Complexity |
|---|---|---|---|
| 7.9 | **Card image gallery** | Add multiple card images (front/back/metal) with a lightbox viewer. | Low |
| 7.10 | **User reviews & ratings** | Allow authenticated users to submit card reviews and ratings (requires auth + moderation). | High |
| 7.11 | **Spend tracker calculator** | Let users input their monthly spending breakdown and see projected annual rewards across their cards. | Medium |
| 7.12 | **EMI calculator** | Add an EMI calculator for purchase financing decisions, a common credit-card use case in India. | Low |

---

## 8. Code Quality & DX

### 🔴 Critical

| # | Improvement | Details | File(s) |
|---|---|---|---|
| 8.1 | **Add ESLint + Prettier** | No linter or formatter is configured. Add `eslint-plugin-astro`, `eslint-plugin-react`, and Prettier for consistent code style. | Root config files |
| 8.2 | **Resolve open TODOs** | Multiple `[PLACEHOLDER]` and `[OPEN QUESTION]` markers exist in `site.ts` (site name, §13.1), `derive.ts`, and design docs. Track and resolve these. | `src/lib/site.ts` |
| 8.3 | **Error boundaries for React islands** | React islands have no error boundaries. If a calculator/quiz crashes, the entire island disappears silently. Wrap each island in `<ErrorBoundary>`. | `src/islands/*.tsx` |

### 🟡 Important

| # | Improvement | Details |
|---|---|---|
| 8.4 | **TypeScript strict mode audit** | While `tsconfig.json` extends `astro/tsconfigs/strict`, verify that no `@ts-ignore` or `as any` casts exist in the codebase. |
| 8.5 | **Centralise error pages** | The 404 and 500 pages exist but don't share a common error layout. Create a shared `ErrorLayout.astro`. |
| 8.6 | **API response types** | Edge function responses lack TypeScript response types. Add shared Zod schemas for request/response validation. |
| 8.7 | **Git hooks + commit linting** | Enforce conventional commits with `commitlint` + Husky (the CONTRIBUTING.md already documents the convention). |

---

## 9. Recommended Agent Skills

Skills discovered via `npx skills find` that are relevant to this project:

### ⭐ Recommended to Install

| Skill | Installs | What it does | Install Command |
|---|---|---|---|
| **Astro Framework** | 1.7K | Astro-specific patterns, components, and best practices | `npx skills add delineas/astro-framework-agents@astro-framework -g -y` |
| **Playwright E2E Testing** | 2.7K | End-to-end testing setup, page object patterns, CI integration | `npx skills add bobmatnyc/claude-mpm-skills@playwright-e2e-testing -g -y` |
| **TypeScript Best Practices** | 3K | Strict typing patterns, utility types, error handling | `npx skills add 0xbigboss/claude-code@typescript-best-practices -g -y` |
| **Vercel Deployment** | 1.6K | Vercel deployment config, preview deploys, edge middleware | `npx skills add sickn33/antigravity-awesome-skills@vercel-deployment -g -y` |
| **React Testing Library** | 1.2K | Component testing patterns for React islands | `npx skills add itechmeat/llm-code@react-testing-library -g -y` |
| **GitHub Actions CI/CD** | 536 | GitHub Actions workflow templates, caching, matrix builds | `npx skills add bobmatnyc/claude-mpm-skills@github-actions -g -y` |

### 🤔 Consider Installing

| Skill | Installs | What it does | Install Command |
|---|---|---|---|
| **Schema Markup** | 579 | Structured data validation and generation | `npx skills add sickn33/antigravity-awesome-skills@schema-markup -g -y` |
| **PWA Development** | 405 | Service worker, manifest, offline patterns | `npx skills add jwynia/agent-skills@pwa-development -g -y` |
| **Image Optimization** | 836 | Image compression, format conversion, responsive images | `npx skills add kostja94/marketing-skills@image-optimization -g -y` |
| **Performance & Web Vitals** | 312 | Core Web Vitals monitoring, Lighthouse integration | `npx skills add dembrandt/dembrandt-skills@performance-and-web-vitals -g -y` |
| **Observability** | 608 | Error tracking, monitoring, alerting setup | `npx skills add alirezarezvani/claude-skills@observability-designer -g -y` |
| **Security Auditor** | 1.1K | Security scanning, vulnerability assessment | `npx skills add sickn33/antigravity-awesome-skills@security-auditor -g -y` |

### ⚠️ Low Install Count — Use With Caution

| Skill | Installs | Notes |
|---|---|---|
| Astro Performance | 20 | Low installs, unverified source |
| CSS Design TDD | 57 | Low installs |
| Dark Mode Implementation | 7 | Very low installs |
| Supabase Edge Functions | 343 | Moderate, but niche source |

---

## Implementation Priority

A suggested execution order that maximises impact while respecting dependencies:

### Phase 1: Foundation (Week 1)
1. ☐ Add ESLint + Prettier (`8.1`)
2. ☐ Fix npm audit vulnerabilities (`5.3`)
3. ☐ Add Open Graph / Twitter Card meta tags (`2.1`)
4. ☐ Add canonical URLs (`2.2`)
5. ☐ Add `Sitemap:` to robots.txt (`2.3`)

### Phase 2: Quality & CI (Week 2)
1. ☐ Create GitHub Actions CI workflow (`6.1`)
2. ☐ Add Playwright E2E tests (`4.1`)
3. ☐ Add error boundaries to React islands (`8.3`)
4. ☐ Add edge function unit tests (`4.2`)
5. ☐ Add pre-commit hooks (`6.5`)

### Phase 3: Performance (Week 3)
1. ☐ Switch to Astro `<Image />` component (`1.1`)
2. ☐ Fix font loading strategy (`1.2`)
3. ☐ Lazy-load React islands with `client:visible` (`1.4`)
4. ☐ Add content security policy (`5.1`)
5. ☐ Add security headers (`5.4`)

### Phase 4: Features (Week 4+)
1. ☐ Dark mode with theme toggle (`7.1`)
2. ☐ Fuzzy search implementation (`7.4`)
3. ☐ PWA support (`7.2`)
4. ☐ Social sharing OG images (`7.3`)
5. ☐ Analytics integration (`7.7`)

### Phase 5: Deployment & Scale (Month 2)
1. ☐ Automated deployment to Vercel/Cloudflare (`6.2`)
2. ☐ Supabase migration CI (`6.3`)
3. ☐ Shareable comparison URLs (`7.5`)
4. ☐ Hindi i18n (`7.8`)
5. ☐ Visual regression testing (`4.4`)

---

> **Note:** This document is a living roadmap. Update the checkboxes as items
> are completed. Use `git log --oneline --since="2026-07-25"` to cross-reference
> implementation dates with this plan.
