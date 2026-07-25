# Contributing to CardCompare.in

Thank you for your interest in contributing to CardCompare.in! This document provides guidelines and instructions for contributing to the project.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Making Changes](#making-changes)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Data Contributions](#data-contributions)

---

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. By participating in this project, you agree to:

- Be respectful and considerate in all interactions
- Welcome newcomers and help them get started
- Accept constructive criticism gracefully
- Focus on what is best for the community and the project
- Show empathy towards other community members

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/ccIndia.com.git
   cd ccIndia.com
   ```
3. **Add the upstream remote:**
   ```bash
   git remote add upstream https://github.com/<org>/ccIndia.com.git
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

---

## Development Setup

### Prerequisites

- **Node.js** ≥ 22.12.0
- **npm** ≥ 9
- A **Supabase** project (optional — seed data fallback works without it)

### Installation

```bash
npm install
cp .env.example .env
# Fill in your Supabase keys (or leave blank to use seed-data fallback)
npm run dev
```

The dev server starts at `http://localhost:4321`.

> **Tip:** You don't need a Supabase project to work on frontend features. The seed-data fallback provides 12 sample cards across 6 banks, which is sufficient for most UI work.

For full setup including database, see the [README](./README.md) and [SUPABASE_GUIDE.md](./SUPABASE_GUIDE.md).

---

## Project Architecture

Before making changes, familiarise yourself with the project structure:

| Area | Location | Description |
|---|---|---|
| **Pages** | `src/pages/` | 28 Astro page files (SSG + 1 SSR) |
| **Components** | `src/components/` | 20 Astro server-rendered components (zero JS) |
| **Islands** | `src/islands/` | 6 React client-hydrated interactive tools |
| **Lib** | `src/lib/` | 14 utility/engine modules (data access, scoring, SEO, formatting) |
| **Styles** | `src/styles/` | CSS design tokens, globals, and island styles |
| **Layouts** | `src/layouts/` | 3-tier layout hierarchy (Base → Page → Article) |
| **Edge Functions** | `supabase/functions/` | 6 Deno Edge Functions + shared utilities |
| **Migrations** | `supabase/migrations/` | 7 SQL migration files |
| **Scripts** | `scripts/` | Data import and enrichment pipelines |
| **Source Data** | `bank-data/` | Raw card data (368 cards, images) |

For detailed architecture documentation, see [architecture.md](./architecture.md).

---

## Making Changes

### Branch Naming

Use descriptive branch names with a category prefix:

| Prefix | Use For |
|---|---|
| `feature/` | New features (e.g., `feature/card-comparison-filters`) |
| `fix/` | Bug fixes (e.g., `fix/mobile-nav-overflow`) |
| `refactor/` | Code refactoring (e.g., `refactor/queries-module`) |
| `docs/` | Documentation changes (e.g., `docs/update-readme`) |
| `style/` | CSS/design changes (e.g., `style/dark-mode-tokens`) |
| `data/` | Data pipeline or card data changes (e.g., `data/add-kotak-cards`) |

### Types of Contributions

#### 🖥 Frontend (Astro Components & Pages)

- Components live in `src/components/` and are **server-rendered with zero JavaScript**
- Use CSS custom properties from `src/styles/tokens.css` — **never hardcode colours, spacing, or font sizes**
- Follow the existing component patterns (see `CardRow.astro` or `Button.astro` for examples)
- All pages must include proper SEO meta tags (title, description, canonical, Open Graph)

#### ⚛️ React Islands

- Islands live in `src/islands/` and are hydrated on the client
- Use the appropriate hydration directive: `client:load`, `client:visible`, or `client:only="react"`
- **Every island must have a fallback/preview mode** for when Supabase or Edge Functions are unavailable
- Import styles from `src/styles/islands.css`

#### 🗄 Backend (Edge Functions)

- Edge Functions are Deno-based and live in `supabase/functions/`
- Share common utilities via `supabase/functions/_shared/`
- Follow the existing CORS and response patterns in `_shared/client.ts`
- All database access must go through RLS-scoped queries

#### 📊 Data Pipeline

- Parsers in `scripts/lib/parse.ts` must be **pure functions** — no side effects, no API calls
- Enrichment is deterministic — no LLM or external API dependencies
- Always support `--dry-run` mode for new scripts
- Guard against misparses (cap reward percentages, handle Indian number formatting)

#### 🎨 Design System (CSS)

- Add new tokens to `src/styles/tokens.css`
- Follow the 8px base grid with 4px half-step spacing system
- Support `prefers-reduced-motion` for any new animations
- Ensure 44px minimum touch targets for interactive elements
- Maintain WCAG AA contrast ratios

---

## Coding Standards

### TypeScript

- **Strict mode** is enabled — no `any` types unless absolutely necessary
- Use path aliases: `@/*`, `@lib/*`, `@components/*`, `@islands/*`, `@layouts/*`
- Export explicit types for all public interfaces
- Prefer `const` over `let`; avoid `var`

### CSS

- **Zero hardcoded values** — use `var(--token-name)` for all colours, spacing, sizes
- Follow BEM-like naming for component-scoped styles
- Mobile-first responsive design with breakpoints at 480/768/1024/1200px
- Use logical properties where appropriate (`inline-start` vs `left`)

### Astro

- Frontmatter goes at the top of `.astro` files between `---` fences
- Keep component props typed with TypeScript interfaces
- Prefer Astro components over React for non-interactive UI
- Use semantic HTML5 elements (`<article>`, `<section>`, `<nav>`, etc.)

### Indian Localisation

This is an India-focused product. Be mindful of:

- **Currency formatting**: Use `formatINR()` and `formatINRCompact()` from `src/lib/format.ts` — always use Indian digit grouping (₹1,00,000 not ₹100,000)
- **CIBIL scores**: Range is typically 300–900 in India
- **Card networks**: Include RuPay alongside Visa/Mastercard/Amex/Diners
- **Income bands**: Use Indian salary ranges (₹3 LPA, ₹10 LPA, etc.)
- **Language**: Use `en-IN` locale; spell "colour", "organise", etc. with British/Indian English

---

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | CSS/formatting changes (not code logic) |
| `refactor` | Code restructuring without behaviour change |
| `perf` | Performance improvements |
| `data` | Card data or pipeline changes |
| `chore` | Build, tooling, or dependency changes |

### Examples

```
feat(discover): add persona-based card discovery page
fix(CardRow): prevent overflow on mobile with long card names
docs(README): update component count and add /discover route
data(import): add support for AU Small Finance Bank cards
refactor(queries): extract card detail assembly into shared helper
```

---

## Pull Request Process

### Before Submitting

1. **Sync with upstream:**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```
2. **Run the build** to catch errors:
   ```bash
   npm run build
   ```
3. **Test locally** by previewing:
   ```bash
   npm run preview
   ```
4. **Check your changes** render correctly at `localhost:4321`

### PR Guidelines

- **One PR per feature or fix** — don't bundle unrelated changes
- **Write a clear description** explaining what changed and why
- **Include screenshots** for any visual/UI changes
- **Reference related issues** using `Fixes #123` or `Relates to #456`
- **Keep PRs focused and small** — large PRs are harder to review

### PR Template

```markdown
## What

Brief description of the change.

## Why

Motivation and context for the change.

## How

Technical approach taken.

## Screenshots

(For UI changes — before/after screenshots)

## Checklist

- [ ] Code follows the project's coding standards
- [ ] CSS uses design tokens (no hardcoded values)
- [ ] Components include proper SEO meta tags (if page-level)
- [ ] React islands have fallback/preview mode
- [ ] Build completes without errors (`npm run build`)
- [ ] Tested on mobile viewport (≤ 480px)
- [ ] CHANGELOG.md updated (for notable changes)
```

---

## Reporting Bugs

When reporting bugs, please include:

1. **Description**: Clear, concise description of the bug
2. **Steps to reproduce**: Numbered steps to reliably reproduce the issue
3. **Expected behaviour**: What should happen
4. **Actual behaviour**: What actually happens
5. **Environment**:
   - Browser and version
   - Device (desktop/mobile)
   - Node.js version
   - Whether using Supabase or seed-data fallback
6. **Screenshots**: If applicable, attach screenshots or screen recordings
7. **Console errors**: Any relevant error messages from the browser or build console

### Bug Report Template

```markdown
**Bug Description**
A clear description of the bug.

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected Behaviour**
What you expected to happen.

**Actual Behaviour**
What actually happened.

**Screenshots**
If applicable, add screenshots.

**Environment**
- Browser: Chrome 126
- Device: MacBook Pro / iPhone 15
- Node: v22.12.0
- Data mode: Supabase / seed-data
```

---

## Requesting Features

Feature requests are welcome! When suggesting a new feature:

1. **Check existing issues** first to avoid duplicates
2. **Describe the use case** — who benefits and how?
3. **Provide examples** of similar features in other products (if applicable)
4. **Consider the scope** — is this a small enhancement or a major new feature?

### Feature Request Template

```markdown
**Feature Description**
A clear description of the feature.

**Use Case**
Who would use this and why?

**Proposed Solution**
How you envision this working.

**Alternatives Considered**
Other approaches you've thought about.

**Additional Context**
Any other relevant information, mockups, or references.
```

---

## Data Contributions

CardCompare.in's value comes from accurate, up-to-date card data. Data contributions are especially valuable:

### Adding New Cards or Banks

1. Add card data to `bank-data/cc-data/Master-data-banks.json` following the existing schema
2. Add card art PNGs to `bank-data/cc-data/card-img/` (and copy to `public/card-img/`)
3. Run the dry-run to validate:
   ```bash
   npx tsx scripts/import-cards.ts --dry-run
   ```
4. Verify parse coverage stats look correct
5. Submit a PR with the data changes

### Updating Card Information

If you notice outdated card data (fee changes, reward rate updates, benefit modifications):

1. Update the relevant field(s) in `Master-data-banks.json`
2. Run the dry-run import and enrichment to verify:
   ```bash
   npx tsx scripts/import-cards.ts --dry-run
   npx tsx scripts/enrich-cards.ts --dry-run
   ```
3. Note the changes in your PR description

### Data Quality Standards

- All monetary values should use INR (₹) denomination
- Annual fees must be exact (not estimated) where possible
- CIBIL requirements should note if estimated with `(est)` marker
- Reward rates should be verified against the issuer's official terms
- Mark `data_confidence` appropriately: `'verified'`, `'partially_estimated'`, or `'estimated'`

---

## Questions?

If you have questions about contributing, feel free to:

- Open a [Discussion](https://github.com/<org>/ccIndia.com/discussions) on GitHub
- Check the [architecture.md](./architecture.md) for technical details
- Read the [SUPABASE_GUIDE.md](./SUPABASE_GUIDE.md) for database setup help

---

<p align="center">
  Thank you for helping make credit card information more transparent for Indian consumers! 🇮🇳
</p>
