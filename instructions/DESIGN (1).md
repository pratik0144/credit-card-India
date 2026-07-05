# CardCompare.in — Design System Documentation (DESIGN.md)

> Design and content system for an Indian credit-card comparison and review platform, adapted from a structural teardown of CreditCards.com (a Red Ventures/US property) and localized for the Indian regulatory, cultural, and competitive environment. Written so an AI coding agent (Claude Code, Cursor, Gemini CLI, Codex, etc.) can build new pages, components, or entire flows from this spec alone, without needing screenshots.
>
> **Provenance and confidence notice:** This document has two kinds of source material, and they carry different confidence levels:
> - **Structural/interaction patterns** (§4–§9, most of §6) come from a manual review of CreditCards.com's live homepage, a card review page (Chase Sapphire Preferred), and a category page (Best Rewards Credit Cards), cross-checked against the rendered site. These patterns — card-row layout, byline blocks, sticky CTA banners, disclosure placement, comparison-table structure — are largely format-agnostic and transfer to an Indian site with only content changes. They're marked unmarked (verified) or **[ESTIMATED]** (plausible but not directly confirmed) as in the original teardown.
> - **Compliance and regulatory content** (§10) has been rewritten from RBI Master Directions on Credit and Debit Cards (2025), the RBI's MITC (Most Important Terms and Conditions) framework, and current Indian card-comparison-site practice (BankBazaar, Paisabazaar) — not carried over from the US original. Anywhere this document cites a specific RBI rule, timeline, or required disclosure, treat it as **directionally correct but not a substitute for legal sign-off** before shipping. RBI directions are amended often; verify current wording against rbi.org.in before this ships to production, and route final disclosure copy through compliance/legal review regardless of what's drafted here.
>
> Values taken directly from source (meta tags, class names, literal copy, URLs, structural order) are unmarked. Values not directly observable are marked **[ESTIMATED]**.

---

## Table of Contents

1. [Brand & Visual Philosophy](#1-brand--visual-philosophy)
2. [Design Principles](#2-design-principles)
3. [Design Tokens](#3-design-tokens)
   - 3.1 [Color System](#31-color-system)
   - 3.2 [Typography System](#32-typography-system)
   - 3.3 [Spacing Scale](#33-spacing-scale)
   - 3.4 [Corner Radius](#34-corner-radius)
   - 3.5 [Elevation & Shadows](#35-elevation--shadows)
   - 3.6 [Borders](#36-borders)
   - 3.7 [Motion & Transitions](#37-motion--transitions)
4. [Layout System](#4-layout-system)
5. [Responsive Design](#5-responsive-design)
6. [Component Library](#6-component-library)
7. [Accessibility](#7-accessibility)
8. [Design Philosophy — Deep Dive](#8-design-philosophy--deep-dive)
9. [Content & Editorial Patterns](#9-content--editorial-patterns)
10. [Trust, Compliance & Financial UI Patterns (India)](#10-trust-compliance--financial-ui-patterns-india)
11. [AI Replication Rules](#11-ai-replication-rules)
12. [Component Checklist for Rebuilds](#12-component-checklist-for-rebuilds)
13. [Open Questions Before Build](#13-open-questions-before-build)

---

## 1. Brand & Visual Philosophy

A credit-card comparison site occupies a specific niche in India: **it is not a bank, not a UPI app, and not a personal-finance influencer's blog — it is a reference authority.** Every visual decision should reinforce three ideas simultaneously: (1) this is a serious financial resource, (2) this is an independent, editorially-driven publication rather than a bank-sponsored sales funnel, and (3) this is easy enough for a first-time cardholder to use in under five minutes. The visual language sits at the intersection of **consumer publishing** (the CreditCards.com/NerdWallet lineage this spec is descended from), **institutional finance** (muted blues, restrained palette — a register Indian users already associate with net-banking portals and RBI-regulated products), and **conversion-first affiliate commerce** (persistent CTAs, rating badges, comparison tables).

This matters more in India than in the US comparison-site market, not less: independent research into the category found that the top comparison sites in India earn affiliate commissions per approved application and that neither major incumbent prominently discloses the affiliate relationship on comparison pages.[^1] That's a live credibility gap in the category this site is entering, not a hypothetical risk — a competitor being clean on this is a differentiator worth designing for, not just complying with. The disclosure prominence and "we get paid but that doesn't drive the ranking" idioms in §10 should read as a genuine positioning choice, not boilerplate to get through.

**Brand personality, in five adjectives:** Trustworthy, Clear, Helpful, Efficient, Understated. The brand should deliberately avoid: playful illustration, bright saturated color, gimmicky animation, or anything that reads as a growth-stage fintech app chasing engagement metrics. It should read instead as "consumer publication with a research desk" — a tone that also happens to differentiate it from cashback-app and gamified-rewards competitors in the Indian market.

**Color psychology:** Blue remains the dominant hue family across logo, links, primary buttons, and active nav states, carried over unchanged from the source system per explicit direction — this is a genuine, defensible design choice independent of geography. Blue in financial UI communicates security and calm in India just as it does in the US; it's also the register of India's largest net-banking and UPI apps (most public-sector and several private banks default to blue-dominant palettes), so it won't read as foreign or borrowed. The palette otherwise stays extremely neutral (white/off-white backgrounds, charcoal/gray text, thin gray borders) so that the *content* — card art, rating numbers, rupee figures — supplies nearly all the color contrast and visual interest on the page. Product imagery and numbers are the "hero," chrome is intentionally quiet.

**Visual hierarchy strategy:** Use a strict "number-first" hierarchy for anything financial. Ratings (e.g., "4.8 / 5"), rewards rates ("5X," "3%"), joining/annual fees ("₹500 + GST"), and interest rates (stated as **monthly percentage** per Indian card-statement convention, with the annualized figure alongside) are always set in larger/bolder type than the surrounding prose, frequently accompanied by a colored word-badge ("Excellent," "Very Good," "Fair") so a scanning user can extract a decision-relevant fact without reading a sentence.

**Editorial tone:** Second-person, advisory, plain-English (with Hindi/regional-language parity as a stated roadmap item, not a v1 requirement — see §13). Sentences favor concrete numbers over adjectives ("10,000 bonus reward points after you spend ₹3 lakh in 90 days" rather than "an amazing bonus"). Headers are almost always framed as the reader's question ("Who should get the HDFC Regalia Gold," "Is the Axis Atlas card right for you?"). This Q&A framing is a recurring rhetorical device across review and category pages, and it maps directly to on-page anchor navigation ("On this page" jump lists).

---

## 2. Design Principles

These are the rules a site in this category should follow, stated explicitly so an agent internalizes *why*, not just *what*. Principles 1–9 are carried over unchanged from the structural teardown of the source site — they're format-agnostic. Principle 10 (mobile-first) is strengthened, not just carried over, for reasons specific to the Indian market.

1. **Numbers outrank adjectives.** Any quantifiable fact (rate, fee, score, bonus amount) gets visual priority — larger size, bold weight, or a badge — over descriptive text making the same claim.
2. **Every recommendation is attributed.** A byline ("Written by," "Edited by," "Reviewed by") sits near every piece of advice or rating. Trust is manufactured through visible authorship, not slogans.
3. **Disclosure is omnipresent, not hidden.** An affiliate/advertiser disclosure label appears near the top of every page, and full disclosure text repeats in the footer of every single page. Given the category-wide disclosure gap noted in §1, this is a competitive as well as ethical requirement.
4. **One primary action per card module.** Every card component has exactly one dominant CTA ("Apply Now"), with rating, "Add to compare," and "View Fees & MITC" as secondary, visually quieter actions.
5. **Comparison is a first-class citizen.** Nearly every content type (review, category list) eventually resolves into a comparison table. Tables are treated as trustworthy artifacts, styled plainly (not "gamified"), because over-designed data feels less credible in finance content.
6. **Category navigation is always one click away.** A horizontal, scrollable pill/tab strip of top card categories persists near the top of listing and category pages, letting users pivot laterally without returning to the mega-menu.
7. **Editorial and commercial content share a template, not a visual language.** A "News/RBI Update" teaser card looks structurally identical to a "Card Review" teaser card (image + eyebrow/category + title + byline + excerpt), reinforcing that advice and offers are presented with equal formal seriousness.
8. **White space signals confidence, not emptiness.** Sections are separated by generous vertical rhythm (large section padding) rather than heavy dividers or background-color blocking, keeping the page feeling like a calm report rather than a busy marketplace.
9. **Never let decoration outrank comprehension.** No gratuitous motion, no illustration for illustration's sake. Icons are functional (arrows, chevrons, star fills) not ornamental.
10. **Mobile is the primary reading context, full stop — not a graceful-degradation target.** India is a mobile-first (frequently mobile-only) internet market; unlike a US comparison site where desktop traffic is still substantial, expect the large majority of sessions here to be mobile, often on mid-range Android devices and variable-quality mobile networks. Design and performance-budget every page mobile-first: copy blocks, tables, and card modules should be authored for a single column first and expanded for desktop, not the reverse. Long comparison tables degrade into horizontal scroll or stacked key/value rows rather than shrinking text to illegibility. Image weight and JS payload should be budgeted with 3G/4G conditions in mind, not just viewport width.

---

## 3. Design Tokens

### 3.1 Color System

The palette is intentionally restrained: near-white surfaces, dark neutral text, one primary blue used for links/CTAs/brand, and a small set of semantic "rating" colors used exclusively inside rating badges and score chips. Values are carried over unchanged from the source teardown — a defensible, geography-agnostic starting point per the direction to keep the existing blue-dominant system.

```css
:root {
  /* ---- Brand / Primary ---- */
  --color-primary-blue:        #0057B8; /* [ESTIMATED] core brand/link/CTA blue */
  --color-primary-blue-dark:   #003E82; /* [ESTIMATED] hover/active state of primary blue */
  --color-primary-blue-light:  #E8F1FC; /* [ESTIMATED] tinted background for callouts, active nav states */

  /* ---- Neutrals ---- */
  --color-text-primary:        #1A1A1A; /* [ESTIMATED] body copy, headings */
  --color-text-secondary:      #4A4A4A; /* [ESTIMATED] byline, meta, captions */
  --color-text-muted:          #767676; /* [ESTIMATED] disclosure copy, fine print, timestamps */
  --color-border:               #E0E0E0; /* [ESTIMATED] card borders, table borders, dividers */
  --color-border-strong:        #C7C7C7; /* [ESTIMATED] input borders, table header borders */
  --color-surface:              #FFFFFF; /* white surface */
  --color-surface-alt:          #F7F8FA; /* [ESTIMATED] section background alternation, "As seen on" strip */
  --color-surface-footer:       #F2F3F5; /* [ESTIMATED] footer background, slightly darker than alt */

  /* ---- CTA / Action ---- */
  --color-cta-primary:          #0057B8;  /* [ESTIMATED] "Apply Now" button fill */
  --color-cta-primary-hover:    #00458F;  /* [ESTIMATED] */
  --color-cta-secondary-border: #0057B8;  /* [ESTIMATED] ghost/outline button border */

  /* ---- Semantic / Rating scale ---- */
  /* Named tiers ("Excellent", "Very Good", "Good", "Fair", "Poor") rendered
     as small badges next to feature rows in review tables. */
  --color-rating-excellent:     #1E7B34; /* [ESTIMATED] deep green */
  --color-rating-very-good:     #4C9A2A; /* [ESTIMATED] mid green */
  --color-rating-good:          #8CB93B; /* [ESTIMATED] yellow-green */
  --color-rating-fair:          #E8A02E; /* [ESTIMATED] amber/orange */
  --color-rating-poor:          #D64545; /* [ESTIMATED] red */

  /* ---- Star / numeric rating ---- */
  --color-star-fill:            #0057B8; /* [ESTIMATED] star/score fill uses brand blue, not gold —
                                              differentiates from generic 5-star e-commerce pattern */
  --color-star-empty:           #D8DCE1; /* [ESTIMATED] */

  /* ---- Functional / Feedback ---- */
  --color-success:              #1E7B34; /* [ESTIMATED] */
  --color-warning:              #E8A02E; /* [ESTIMATED] */
  --color-error:                #C0392B;  /* [ESTIMATED] form validation errors */
  --color-info:                 #0057B8;  /* [ESTIMATED] reuses primary blue */

  /* ---- Overlay / scrim ---- */
  --color-overlay:               rgba(0,0,0,0.5); /* [ESTIMATED] modal/tooltip backdrop, e.g. rating methodology popover */
}
```

**Usage rules:**
- Primary blue is reserved for: logo mark, hyperlinks in body copy, primary button fills, active nav underline/chevron, focus rings.
- Neutrals do the heavy lifting. At least 80% of any given viewport should be white/off-white/gray — color is a seasoning, not a base.
- Rating-tier colors (green→red) appear **only** inside the small feature-scoring badges in spec tables (fee tier, interest-rate tier, CIBIL-score-requirement tier) — never as decorative background fills elsewhere.
- Never introduce a second brand hue (no purple, no teal, no saffron/green-as-decoration) — this is a single-accent system. If a future brand refresh wants to nod at national color associations, that's a conscious top-of-funnel brand decision to make deliberately, not something to bolt on here — see §13.

### 3.2 Typography System

The site is copy-dense (long-form reviews, big comparison tables, FAQ blocks), so the type system prioritizes legibility and scanability over expressive display type. One addition versus the source system: **font stacks need explicit Devanagari/Indic-script fallbacks** even if v1 ships English-only, so that any user-generated content, bank names in regional scripts, or future localization doesn't silently fall back to tofu boxes or a jarring serif substitute.

```css
:root {
  --font-primary: "Roboto", "Noto Sans", "Helvetica Neue", Arial, sans-serif; /* [ESTIMATED] grotesque sans;
     Noto Sans added ahead of Arial as an Indic-script-safe fallback (covers Devanagari, Tamil, etc.)
     without changing the Latin rendering, since Roboto/Helvetica/Arial don't cover those scripts */
  --font-fallback: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Arial, sans-serif;

  /* ---- Type scale (desktop) ---- */
  --text-display:      2.5rem;   /* 40px — [ESTIMATED] H1 on landing/category pages e.g. "Best Rewards Credit Cards of July 2026" */
  --text-h1:            2rem;     /* 32px — [ESTIMATED] article/review H1 */
  --text-h2:            1.5rem;   /* 24px — [ESTIMATED] section headers, "Pros and cons," "Rewards" */
  --text-h3:            1.25rem;  /* 20px — [ESTIMATED] card titles, subsection headers */
  --text-h4:            1.125rem; /* 18px — [ESTIMATED] "At A Glance" field labels, table headers */
  --text-body-lg:       1.125rem; /* 18px — [ESTIMATED] intro/lede paragraph */
  --text-body:          1rem;     /* 16px — [ESTIMATED] standard paragraph */
  --text-body-sm:       0.875rem; /* 14px — [ESTIMATED] byline, meta, disclosure inline text */
  --text-caption:       0.75rem;  /* 12px — [ESTIMATED] legal fine print, footer disclosure body */
  --text-button:        1rem;     /* 16px, medium/semibold — [ESTIMATED] */
  --text-rating-number: 2rem;     /* 32px — [ESTIMATED] "4.8 / 5" numerals in rating tables */

  /* ---- Line height ---- */
  --leading-tight:   1.2;   /* headings */
  --leading-normal:  1.5;   /* body copy */
  --leading-relaxed: 1.7;   /* long-form article paragraphs */
  /* NOTE: if/when Hindi or other Indic-script body copy ships, budget +0.1–0.15 on
     --leading-normal/--leading-relaxed for that locale — Devanagari and other Indic
     scripts need more vertical breathing room at the same point size than Latin text. */

  /* ---- Letter spacing ---- */
  --tracking-tight:  -0.01em; /* large display headings */
  --tracking-normal: 0;
  --tracking-wide:   0.04em;  /* small-caps labels: "AFFILIATE DISCLOSURE", eyebrow category tags */

  /* ---- Font weights ---- */
  --weight-regular:  400;
  --weight-medium:   500;
  --weight-semibold: 600;
  --weight-bold:     700; /* headings, rating numbers, CTA button text, rupee figures */
}
```

**Typography philosophy:** Headings are set in the same sans-serif family as body copy (no serif/sans pairing) — this keeps the page feeling like "one voice," not a magazine layout with editorial flourish. Weight and size carry all hierarchy; italics are essentially unused except for small inline "Tip:" callouts. Numerals (fees, rates, ratings) are consistently bolder and sometimes larger than their surrounding label text — e.g., "₹500 + GST" under "Joining fee" is bold while "Joining fee" itself is regular weight, uppercase-ish label styling.

**Rupee formatting is a typography rule, not just a content rule:** use the ₹ symbol (not "Rs." or "INR") set in the same weight as the numeral it prefixes, and format large numbers with the Indian numbering system (lakh/crore grouping — "₹3,00,000" not "₹300,000") throughout, including inside tables and badges. This is a genuine reading-comprehension issue for an Indian audience, not a stylistic nicety — Western-grouped numerals ("₹300,000") force an extra parse step for readers used to lakh/crore grouping. Never mix the two grouping conventions on the same page.

**Reading width:** Long-form article and review body copy is constrained to a comfortable measure — approximately 680–720px **[ESTIMATED]** — even though the outer page container is much wider, because side rails (sticky CTA card, table of contents) occupy the remaining width on desktop.

### 3.3 Spacing Scale

An 8px-based scale (with a 4px half-step for tight component-internal spacing), carried over unchanged.

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
}
```

**Usage guide:**
- `--space-2` / `--space-3`: internal padding of small badges, gaps between inline meta items (byline separators).
- `--space-4` / `--space-6`: card component internal padding, form field spacing.
- `--space-8` / `--space-12`: spacing between major card modules in a list (review teaser cards on the homepage), spacing between a table and its caption/footnote.
- `--space-16` / `--space-24`: vertical rhythm between full page sections ("Top card picks" → "How your CIBIL score affects approval" → newsletter band → footer).

### 3.4 Corner Radius

```css
:root {
  --radius-sm:   4px;  /* [ESTIMATED] badges, small chips, input fields */
  --radius-md:   8px;  /* [ESTIMATED] buttons, card containers */
  --radius-lg:   12px; /* [ESTIMATED] large card modules, modals/popovers */
  --radius-pill: 999px; /* category filter pills, "Filter by" chips */
  --radius-circle: 50%; /* avatar/author headshots, close (×) buttons */
}
```

Card art (credit card product photography) is displayed with **no radius applied to the image itself** beyond what's baked into the source PNG — cards already have rounded corners in the photography, so the container around them stays square or very slightly rounded to avoid double-rounding artifacts.

### 3.5 Elevation & Shadows

Visually flat by comparison-site standards — shadows are subtle, used mainly to lift the "sticky CTA / offer" card and popover/tooltip content off the page, not for general card differentiation.

```css
:root {
  --shadow-elevation-1: 0 1px 2px rgba(0,0,0,0.06);              /* [ESTIMATED] resting card border-adjacent shadow */
  --shadow-elevation-2: 0 2px 8px rgba(0,0,0,0.08);              /* [ESTIMATED] sticky apply-now card, dropdown menus */
  --shadow-elevation-3: 0 8px 24px rgba(0,0,0,0.12);             /* [ESTIMATED] modals, "rating methodology" popover, mega menu flyout */
  --shadow-hover:       0 4px 12px rgba(0,0,0,0.10);             /* [ESTIMATED] hover lift on clickable card teaser */
}
```

**Rule:** Never stack more than one elevation level's worth of shadow. Never use colored shadows. Never use shadow as the *only* separator between adjacent cards — pair it with a 1px border or leave a full spacing gap instead.

### 3.6 Borders

```css
:root {
  --border-width-hairline: 1px;
  --border-width-thick:    2px; /* focus rings, active tab underline, table header bottom rule */
  --border-color-default:  var(--color-border);
  --border-color-strong:   var(--color-border-strong);
  --border-style:          solid;
}
```

Tables rely on hairline borders (1px, light gray) between rows/cells rather than zebra-striping as the primary structuring device, though light zebra striping **[ESTIMATED]** may appear in dense comparison tables for scanability.

### 3.7 Motion & Transitions

Motion is utilitarian — never decorative, never bouncy. It exists to (a) confirm that a click registered, and (b) smooth a menu/accordion open-close so it doesn't feel jarring. On a market where a meaningful share of sessions are on mid-range hardware and variable networks, "utilitarian" also has a performance dimension: keep animated properties limited to `opacity`/`transform` (compositor-friendly) and avoid animating anything that triggers layout/paint on lower-powered devices.

```css
:root {
  --duration-fast:   120ms; /* [ESTIMATED] button hover/active state */
  --duration-base:   200ms; /* [ESTIMATED] dropdown open, tab switch, accordion */
  --duration-slow:   320ms; /* [ESTIMATED] mega-menu flyout, modal open */
  --ease-standard:   cubic-bezier(0.4, 0, 0.2, 1); /* [ESTIMATED] standard material-like easing */
  --ease-out:        cubic-bezier(0, 0, 0.2, 1);
  --ease-in:         cubic-bezier(0.4, 0, 1, 1);
}
```

- Hover states use color/opacity transitions only — no scale/transform bounce on financial CTAs (a bouncy "Apply Now" button would undercut trust).
- Accordions ("Show More/Less" on trust blocks, FAQ blocks) slide/fade open over `--duration-base`.
- Reduced-motion: all transitions collapse to near-instant (`0ms`–`50ms` crossfade only) when `prefers-reduced-motion: reduce` is set. No parallax, no auto-playing motion anywhere on the site.

---

## 4. Layout System

**Container widths:**
- Max content width: **1200px** **[ESTIMATED]**, centered, with fluid gutters below that.
- Article/review reading column within the wide container: **~720px** **[ESTIMATED]**, with a secondary rail (sticky offer card, table of contents) filling the remainder on desktop (≈ 320–360px rail). Given the mobile-first traffic expectation (§2, principle 10), treat the desktop rail as a genuine enhancement, not the primary design target — build and test the single-column mobile layout first, then layer the rail on for wider viewports.
- Category/listing pages (e.g., `/best-cashback-cards/`) use the full 1200px width for the filter bar and card list, since card modules themselves are wide (spanning the full column) rather than in a multi-column grid — this is a **single-column list of wide "card row" modules**, not a Pinterest-style grid. Individual credit-card recommendation modules stack vertically, full-width, one per row, each internally organized as image + rate table + editor's take + pros/cons + CTA.

**Grid columns:** 12-column conceptual grid **[ESTIMATED]** at desktop widths, mostly expressed as flex/stacked layouts rather than visible grid gutters, because most content (tables, long-form text, single-column recommendation cards) doesn't need multi-column card grids. Where multi-column grids *do* appear (a three-column "tools you need" homepage block, the "As seen on" logo strip, footer link columns), they use 3–4 equal columns on desktop collapsing to 1–2 on mobile.

**Section spacing:** Full-bleed background sections (alternating white / `--color-surface-alt`) are separated by `--space-16`–`--space-24` of vertical padding. Section headers ("Top card picks this month," "Understand your CIBIL score") are centered or left-aligned H2s with `--space-8` margin below before content begins.

**Sidebar / sticky elements:**
- On review pages, a sticky mini-header appears containing card thumbnail + card name + "Apply Now" — this persists as the user scrolls past the original hero, ensuring the CTA is always reachable, with an explicit dismiss control.
- A left/vertical anchor nav ("On this page" jump list) is present on long review and category pages, generated from the H2 structure, allowing users to skip to "Fees & charges," "Rewards," "Eligibility," "FAQ," etc.

**Breadcrumbs:** A simple `>`-free, link-separated breadcrumb trail appears directly above the H1 on review pages (`Reviews / Cashback Credit Cards / [Card Name] review`) — plain text links, small size, muted color, no background chip.

**Reading flow (review page, top to bottom):**
1. Sticky/dismissible top offer banner (thumbnail + name + Apply Now)
2. Breadcrumb trail
3. Card hero image (clickable, links to card detail page)
4. H1 title
5. Byline block (Written by / Edited by / Reviewed by / Updated date) + duplicate "Apply Now" CTA
6. Affiliate/advertiser disclosure label
7. Overall rating table (category sub-scores)
8. "In a Nutshell" summary paragraph + two CTAs ("View Fees & MITC," "Learn more about this card")
9. At-a-glance spec table (Reward Rate / Welcome Benefit / Joining Fee / Annual Fee / Interest Rate (Monthly) / Minimum CIBIL Score, each with a tier badge)
10. Pros & Cons two-column list
11. Long-form "Why you might want this card" sections with H3 subheads
12. "Why you might want a different card" (balanced counter-argument section — always present)
13. Competitor comparison table (3-up card comparison)
14. "Who should get this card" bulleted persona list
15. "How to use this card" actionable bulleted list (e.g., how to hit a milestone spend threshold, how fee-waiver spend thresholds work)
16. Final verdict paragraph ("Is [card] right for you?")
17. Legal/editorial disclosure footnotes
18. Repeated CTA
19. Global disclosure blob (Affiliate Disclosure + Editorial Independence + CIBIL/credit-score disclosure)
20. "As seen on" logo strip (see §13 — needs an India-specific outlet list, not a carried-over US one)
21. Newsletter signup band
22. Global footer

This 22-step rhythm is carried over unchanged from the source teardown and should be treated as the canonical article template — it's a content-agnostic reading-order pattern, not a US-specific one.

---

## 5. Responsive Design

**Breakpoints [ESTIMATED, standard for this class of site]:**

```css
/* Mobile first */
--bp-sm:  480px;   /* large phones */
--bp-md:  768px;   /* tablets / nav collapse threshold */
--bp-lg:  1024px;  /* small laptops */
--bp-xl:  1200px;  /* desktop, matches max container width */
```

**Navigation collapse:** Full mega-menu (Card Category / Card Issuer / Credit Score Range / Resources / Our Team, each with flyout sub-lists) is desktop-only (≥1024px). Below that, it collapses into a hamburger-triggered slide-in or accordion-style mobile menu where each top-level item becomes an expandable accordion header revealing its children indented beneath it. The horizontal category pill/tab strip (Best Credit Cards / Lifetime Free / Cashback / Travel / Rewards / Business / Fuel / Low Interest) becomes horizontally scrollable with hidden overflow and edge affordance arrows.

**Card stacking:** Recommendation/review "card row" modules are single-column at all viewport widths on listing pages — mobile simply reduces internal padding and stacks what were side-by-side sub-elements (rate table cells, at-a-glance stats) into a vertical stack.

**Table overflow:** Comparison tables (the 3-competitor-card table, the airport-lounge-value table) switch to horizontal scroll with momentum scrolling on mobile, OR restructure into a stacked "label: value" repeating block per card **[ESTIMATED — both patterns are viable; horizontal scroll is likely preferable where card-image-topped columns matter for recognition]**. Table font size may drop one step (16px→14px) at mobile widths to fit more columns before scrolling kicks in.

**Typography scaling:** Display/H1 sizes reduce by roughly 25–30% between desktop and mobile (e.g., 40px→28px, 32px→24px) **[ESTIMATED]**; body copy stays fixed at 16px minimum for legibility and to respect iOS zoom-on-focus avoidance for form inputs. Given the higher share of Android/mid-range-device traffic expected here versus a US site, also verify against Android's equivalent input-zoom behavior, which is less universally documented than iOS's but follows a similar 16px-safe convention on most stock browsers.

**Image scaling:** Card product photography uses responsive `<img>` with `max-width: 100%; height: auto;` and a fixed aspect ratio container to avoid layout shift, using a standard card-art aspect ratio of roughly 1.59:1 (matching the ~500×315 convention observed on the source site) sitewide. Given network-variability considerations (§2, principle 10), serve responsive `srcset`/modern formats (WebP/AVIF with fallback) more aggressively than a US-market site might need to — this is a bigger lever for perceived performance here than most other frontend decisions.

**Spacing adjustments:** Section vertical padding compresses from `--space-24`/`--space-20` (desktop) to `--space-12`/`--space-10` (mobile) **[ESTIMATED]**; component internal padding compresses less aggressively to preserve tap-target comfort.

**Sidebar changes:** The sticky "Apply Now" offer rail and "On this page" anchor nav (both desktop side-rail elements) either disappear on mobile in favor of the top sticky banner doing that job, or the anchor-nav collapses into a "Jump to" `<select>`-style dropdown — the latter is the recommended default given how central mobile is to this build.

---

## 6. Component Library

For each component: purpose, structure, sizing/spacing, typography, color, states, mobile behavior, accessibility notes, and common mistakes to avoid.

### 6.1 Global Header / Navigation

**Purpose:** Primary wayfinding across the entire card taxonomy (category, issuer, credit-score range) plus editorial resources and a persistent lead-gen CTA (a "which card can I get" eligibility-check tool — the Indian-market equivalent of CreditCards.com's CardMatch™; naming TBD, see §13).

**Structure (desktop):**
```
[Logo] [ChevronLeft/Right scroll arrows]  Check My Eligibility | Card Category ▾ | Card Issuer ▾ | Credit Score Range ▾ | Resources ▾ | Our Team ▾
```
- Logo: SVG, left-aligned, links to homepage. Height **[ESTIMATED]** ~32–36px.
- Top-level nav items are plain text links with a `▾`/chevron affordance when they own a flyout. The eligibility-check tool is the one top-level item styled distinctly (often bolder or with a subtle background chip) because it's the site's core lead-gen tool and effectively a persistent CTA disguised as a nav item.
- Flyout menus (mega-menu): on hover/click of "Card Category," "Card Issuer," etc., a panel drops down containing a vertical list of links (e.g., Best Cashback Cards, Best Travel Cards, Best Lifetime-Free Cards…). Issuer flyout lists major Indian issuers by logo/name — HDFC Bank, SBI Card, ICICI Bank, Axis Bank, American Express, IDFC FIRST Bank, Kotak Mahindra Bank, Yes Bank, IndusInd Bank, RBL Bank (confirm final list against actual coverage before launch — see §13).
- Small arrow icons adjacent to the logo serve as horizontal-scroll affordances for the nav row itself, confirming the top nav row is a horizontally-scrollable strip even at desktop sizes.

**Sizing/spacing:** Header height **[ESTIMATED]** 64–72px desktop, 56px mobile. Horizontal padding matches container gutter (`--space-6`–`--space-8`).

**Typography:** Nav items ~14–15px, medium weight, `--color-text-primary` or `--color-primary-blue` on active/hover.

**Color usage:** White/`--color-surface` background, `--color-border` 1px bottom hairline separating header from page content. Active/hovered top-level item text switches to `--color-primary-blue`; flyout panel gets `--shadow-elevation-3` and white background.

**States:**
- *Hover:* underline or color shift to primary blue on nav item; flyout panel fades/slides in over `--duration-base`.
- *Focus:* visible focus ring (`2px solid var(--color-primary-blue)`, offset 2px) for keyboard users.
- *Active/current section:* [ESTIMATED] bolder weight or blue underline on the top-level item matching the current page's taxonomy.

**Mobile behavior:** Collapses to logo + hamburger icon. Tapping hamburger opens a full-height slide-in drawer with accordion-style top-level items; the eligibility-check CTA typically remains visible/pinned as it's the top conversion priority.

**Accessibility notes:** Flyouts must be operable via keyboard (Tab to trigger, Enter/Space to open, Escape to close, Arrow keys to move within panel) and must expose `aria-expanded`/`aria-haspopup` on trigger elements. Logo link must have an accessible name like "[Site name] home," not just alt="Logo".

**Common mistakes to avoid:** Do not make the mega-menu hover-only (breaks on touch devices and keyboard nav) — always support click/tap-to-toggle in addition to hover on pointer devices. Do not nest more than 2 levels of flyout.

---

### 6.2 Category Pill / Tab Strip

**Purpose:** Lateral navigation between the primary card categories, present near the top of category and homepage content.

**Structure:** Horizontal row of short text pills/links: `Best Credit Cards | Lifetime Free | Cashback | Travel | Rewards | Business | Fuel | Low Interest`, flanked by left/right chevron arrow icons for scroll affordance. (Category set should be validated against actual card supply/editorial coverage before lock — see §13; "0% APR" from the US original doesn't map cleanly to India, since Indian cards don't typically carry a 0% purchase-APR marketing category — see §10 for why.)

**Sizing:** Pill padding **[ESTIMATED]** `--space-2` `--space-4` (8px/16px), pill height ~32–36px, `--radius-pill` corners, small gap (`--space-2`) between pills.

**Typography:** 13–14px, medium weight.

**Color usage:** Default pill: transparent/white background, `--color-text-primary` text, thin `--color-border` outline OR no border with just spacing (text-link style).

**States:** *Active/current category:* filled background in `--color-primary-blue-light` with `--color-primary-blue` text, or a bold underline — the pattern used to show the user "you are here" within the category taxonomy.

**Mobile behavior:** Horizontally scrollable with `overflow-x: auto` and `scroll-snap-type: x mandatory` **[ESTIMATED]**; arrows may hide on touch devices in favor of native swipe.

**Accessibility notes:** Implement as a `nav` with plain links (`<a>` tags to category pages), not ARIA tabs, since each pill is a hard navigation to a new URL rather than an in-place filter.

---

### 6.3 Credit Card Recommendation Module ("Card Row")

**Purpose:** The site's core conversion unit — appears on every category/listing page, once per recommended card, in a strict vertical stack.

**Structure (desktop, top-to-bottom within the row):**
1. **Eyebrow label** ("Best for airport lounge access") — small caps or medium-weight label above the card title.
2. **Card name** as H3, linking to full review.
3. **Card art thumbnail** (1.59:1 aspect convention) + **star/numeric rating** ("Our rating: 4.5") with an info icon that opens a "More information" popover explaining the rating methodology, dismissible via a "Close" affordance.
4. **"View Fees & MITC" link** + **"Add to compare" checkbox/button** + primary **"Apply Now"** button (with "on [Issuer]'s secure site" trailing microcopy for transparency).
5. **Rewards rate block**: repeated rate-tier rows, each showing a bold multiplier/percentage ("5X Reward Points," "2% Cashback") followed by a one-line description of the earning category.
6. **At A Glance stat block**: Welcome Benefit / Joining Fee / Annual Fee (+ fee-waiver spend threshold if applicable) / Interest Rate (Monthly) / Minimum CIBIL Score Recommended — each a label+value pair, where "Welcome Benefit" and "Minimum CIBIL Score" carry their own "More information" popovers.
7. **Editor's take**: sub-rating breakdown (Rewards Value, Fees & Charges, Welcome Benefit, Flexibility, Issuer Service Experience, each 0–5) + "Why we like this card" paragraph + "Read the full review" link.
8. **Pros / Cons** two-column bulleted list.
9. **Bottom Line** one-sentence verdict, bolded lead-in label.
10. **Card details (expandable)**: "Highlights" bulleted list (long-form feature dump) + "Fees & Charges" mini key-value table + "View Full [Card] Details & MITC" link to the dedicated card page.

**Sizing/spacing:** Full container width (up to 1200px), internal padding `--space-6`–`--space-8`, `--space-8`–`--space-12` vertical gap between successive card rows, 1px `--color-border` divider or full whitespace gap separating rows.

**Typography:** Card name H3 (~20–22px bold), eyebrow ~12–13px uppercase/medium `--color-text-secondary`, rate numbers bold ~18–20px, body copy 15–16px.

**Color usage:** White card background, `--color-border` outline or none (relying on the alternating page background), primary blue for all interactive text/buttons, tier-badge colors only inside the At-A-Glance row's small badge icons.

**Hover state:** Card name and "Read the full review" links underline or shift to `--color-primary-blue-dark`; "Apply Now" button darkens (`--color-cta-primary-hover`) with no scale transform.

**Focus state:** Every interactive sub-element (rating info icon, Add to compare, Apply Now, Read full review, expand triggers) needs its own visible focus ring — this component has unusually high interactive-element density for a single "card," so keyboard tab order must be logical top-to-bottom.

**Pressed state:** Button fill darkens further; checkbox ("Add to compare") shows filled/checked state with brand blue check.

**Disabled state:** [ESTIMATED] "Add to compare" likely disables/grays out once a max comparison limit (suggest 3, matching the source pattern) is reached, with a tooltip explaining the limit.

**Mobile behavior:** All the above stacks to single column; the rewards-rate rows and at-a-glance stats collapse from side-by-side to full-width stacked rows; "Card details" section defaults to collapsed/accordion on mobile to manage page length, expandable via a "Show more" tap target.

**Accessibility notes:** The "More information" popovers (rating methodology, welcome-benefit detail, CIBIL-score explanation) must be reachable and dismissible by keyboard, and their trigger icons need accessible labels like "What does this rating mean?" rather than a bare icon with no text alternative. Rating value must be exposed as text ("4.5 out of 5"), never conveyed by star-fill color alone.

**Common mistakes to avoid:** Do not make "Apply Now" and "Read the full review" visually equal weight — Apply Now must always be the more prominent (filled) button; the review link stays a text link or ghost/outline button. Do not omit the "on [Issuer]'s secure site" trailing microcopy — this is a recurring trust/transparency signal that a click will leave the site. Do not collapse Pros and Cons into a single mixed list — they are always two clearly separated, labeled columns/sections.

---

### 6.4 Rating Widget (Star / Numeric Score)

**Purpose:** Communicate the editorial team's evaluation of a card at a glance, both in list contexts (single overall number) and detail contexts (sub-category breakdown).

**Structure:** `Our rating: [4.5]` where 4.5 is a large bold numeral, accompanied by a "More information" affordance that expands an explanatory paragraph in the spirit of: *"Our writers and editors score cards based on fees, rewards value, and issuer service quality. Card issuers have no influence on how we rate cards…"* with a link to the full ratings methodology page. Phrasing here should be adapted, not copied verbatim, from the source pattern; the affiliate-relationship candor discussed in §1 makes the exact wording of this disclaimer worth deliberate copywriting, not a placeholder.

On review detail pages, this expands into a full breakdown table:
```
Overall Rating: 4.5 / 5
 ├─ Rewards Value: 4.5
 ├─ Fees & Charges: 3.5
 ├─ Welcome Benefit: 5.0
 ├─ Flexibility: 4.0
 └─ Issuer Service Experience: 4.0
```

**Sizing:** Overall numeral large and bold (~24–32px); sub-scores smaller (~14–16px) in a simple label/value table row format.

**Color usage:** Numeral in `--color-text-primary` or `--color-primary-blue` — **not** the tiered green/red rating colors, since the numeric score is a single continuous 0–5 scale, not a categorical tier. (Tiered colors are reserved for the separate "Excellent/Very Good/Fair" badge system used on discrete spec rows like fee tier or interest-rate tier.)

**Interaction:** Clicking/tapping "More information" toggles an inline disclosure box (not a full modal) directly beneath the rating, with a "Close" text control to collapse it again. Disclosure/accordion pattern, not a true modal — no focus trap, no background dim.

**Accessibility notes:** Must use `aria-expanded` on the toggle and ensure the numeral is in the accessible text (not an image of a number). If star icons are used decoratively alongside the numeral, they must be `aria-hidden="true"` with the numeral/text as the actual accessible content.

**Common mistakes to avoid:** Don't rely on 5-gold-stars alone — the numeric score should be primary, with stars (if present) as secondary reinforcement, which is more precise for financial trust content than pure star iconography.

---

### 6.5 Buttons

**Primary ("Apply Now"):** Solid fill `--color-cta-primary`, white bold text, `--radius-md`, generous horizontal padding (`--space-6`–`--space-8`), height ~44–48px **[ESTIMATED]** to satisfy comfortable tap targets. This is the only button style permitted to appear more than once per card module (top sticky banner + inline near rating + bottom of module) because it is the site's core monetization action.

**Secondary / Outline ("Learn more about this card," "View Fees & MITC" in some contexts):** Transparent fill, `--color-primary-blue` border and text, same radius/height family as primary but visually lighter.

**Ghost / Link buttons ("Read the full review," "See all cashback card reviews," breadcrumb links, footer links):** No border, no background, `--color-primary-blue` text, underline on hover only (not by default) — used for the vast majority of in-content navigation since the site is link-dense and full buttons everywhere would create visual noise.

**Tertiary utility ("Add to compare," "Close," "Back," "Next" in forms):** Small, often icon+text, neutral gray or blue text on transparent/light-gray background, used inside forms and comparison tools.

**Sizing:**
```css
--btn-height-lg: 48px;   /* [ESTIMATED] primary Apply-Now on hero/sticky */
--btn-height-md: 40px;   /* [ESTIMATED] standard inline CTAs */
--btn-height-sm: 32px;   /* [ESTIMATED] Add to compare, form Back/Next */
--btn-padding-x: 24px;   /* [ESTIMATED] */
--btn-radius: var(--radius-md);
```

**States:**
- *Hover:* darken fill (primary) or fill-in background (outline/ghost) by ~10% — color transition only, `--duration-fast`.
- *Focus:* 2px offset outline in `--color-primary-blue`, always visible on `:focus-visible`.
- *Active/pressed:* darken further, no transform/scale.
- *Disabled:* 40–50% opacity, no pointer cursor, no hover transition — used in multi-step forms (eligibility-check flow) where "Next" is disabled until required fields validate.

**Common mistakes to avoid:** Never use red for a primary CTA (reserved for error/warning semantics only). Never make ghost/link buttons look identical to plain body-copy links without at least a weight or color differentiator, since they need to be scannable as *actions* within paragraph-dense pages.

---

### 6.6 Tables (Comparison & Spec Tables)

**Purpose:** The site's primary tool for objective, side-by-side financial comparison — used for card-vs-card comparisons, airport-lounge/transfer-partner value tables, and spec/rate breakdowns.

**Structure variants:**
1. **Card-image-header comparison table** (3 competing cards side by side): each column headed by card art + card name (linked), then rows for Reward rate / Welcome benefit / Joining & annual fee / Other things to know.
2. **Simple 2-column data table** (e.g., airport lounge partner list, redemption partner values): "Lounge network / Redemption partner" | "Value / Access detail" — plain, dense.
3. **Full listing comparison table** ("Comparing the best cashback credit cards of July 2026"): Credit Card | Best for | Reward rate | Annual fee | Our Rating — the widest table, appears near the top of category pages as a scannable summary before the detailed card-by-card modules.

**Sizing/spacing:** Cell padding `--space-3`–`--space-4`, row hairline borders (`--color-border`, 1px), header row bolder weight with slightly heavier bottom border (`--border-width-thick`).

**Typography:** Header row ~14–15px bold; body cells 14–15px regular, with bolded key figures (fee amounts, rates) inside cells even though the cell itself isn't a "header."

**Color usage:** White background, no zebra striping confirmed but plausible **[ESTIMATED]** for the widest summary table to aid row-scanning; card-rating numbers within tables link to the review and are styled as a clear link (blue, e.g. "4.5 / 5" as a hyperlink in the summary table).

**Mobile behavior:** Card-image-header comparison tables likely convert to horizontally scrollable tables (preserving column-per-card structure, since breaking a "column = one card" table into stacked rows would confuse the comparison purpose). Simple 2-column data tables can safely stack/wrap on narrow screens without losing meaning.

**Accessibility notes:** Use real `<table>`, `<thead>`, `<th scope="col">` markup — never div-based fake tables — since screen reader users need row/column relationships for financial comparison data. Provide a caption or visually-hidden heading identifying what's being compared.

**Common mistakes to avoid:** Don't truncate the annual fee or interest-rate figures with ellipsis on mobile — these are the exact figures a user is comparing tables to find; if space is tight, wrap text rather than truncate. Don't remove the card images from the comparison table on mobile purely to save space — the card art is itself a recognition cue.

---

### 6.7 Forms (Eligibility-Check / Approval-Odds Flow)

**Purpose:** Multi-step lead-generation form collecting PII (name, address, employment, income, PAN, email/mobile) to return personalized card offers/approval odds — the site's highest-value conversion flow, so trust signaling is maximal here. This flow has a materially different legal footing in India than in the US (see §10 before implementing) — most importantly, this form should perform a **soft inquiry** (no CIC record, no score impact) and must say so explicitly and prominently, and it must collect **PAN**, not any full government ID number, as the tax/identity field.

**Structure:** A **linear wizard**, one question (or small cluster) per screen:
1. Intro/explainer screen: "Check your approval odds before you apply" — 3-step numbered explainer + a plain-language encryption/security trust line (avoid citing a specific bit-depth like "256-bit encryption" unless it's actually true of the implementation — don't carry over the US original's specific claim without verifying it applies here).
2. Name (Full name, as per PAN)
3. Mailing address (Street address, City, State, PIN code — use "PIN code," the Indian term, never "ZIP code")
4. Employment status (button-group single-select: Salaried / Self-Employed / Business Owner / Student / Retired / Other)
5. Annual income (currency input in ₹, with expandable help text clarifying what counts as income)
6. Existing EMI/loan obligations (currency input) — the Indian-market equivalent of the US flow's "monthly rent/mortgage" question, but framed around existing credit obligations since that's what issuers and CICs actually weight
7. PAN (Permanent Account Number — India's tax-ID equivalent; NOT an SSN analog, don't ask for Aadhaar number here, see §10) — marked "Secure," with masked input
8. Mobile number + Email address (mobile is arguably the primary identifier in the Indian market — OTP-based flows are the norm — so treat mobile number as at least as important as email, possibly gating the flow on mobile OTP verification rather than email confirmation)
9. Consent screen with linked Terms of Use / Privacy Policy and explicit consent language for the **soft-pull credit check**, directly above the submit button
10. Loading state: "Checking your approval odds"
11. Error state: graceful fallback message and a "Return to cards" recovery action.

Every screen after the first carries a persistent **Back** (ghost button, left) and **Next** (primary button, right) pair, except the final screen where Next becomes "Check my odds."

**Sizing/spacing:** Inputs full-width within a constrained form column (~400–480px **[ESTIMATED]** on desktop, full-width on mobile), label above input, generous vertical spacing (`--space-6`) between fields to reduce error and support fat-finger-proof mobile completion — this matters more here than in a desktop-leaning market, given the mobile-first traffic expectation.

**Typography:** Field labels 14–15px medium; helper/explainer text 13–14px `--color-text-muted`; input text 16px (never smaller, to prevent mobile browser auto-zoom on focus).

**Color usage:** Input borders `--color-border-strong` at rest, `--color-primary-blue` on focus, `--color-error` on validation failure with an inline error message below the field.

**Input component states:**
- *Default:* white background, 1px gray border, `--radius-sm`.
- *Focus:* blue border + subtle blue glow/ring, label may shrink/float **[ESTIMATED — floating label pattern common but unconfirmed]**.
- *Filled/valid:* border returns to neutral or shows a subtle success indicator.
- *Error:* red border, red helper text, icon **[ESTIMATED]**.
- *Disabled:* grayed background, muted text, no focus ring.

**Trust microcopy placement:** Every sensitive field (PAN, income) needs an adjacent one-line explanation of *why* it's needed and reassurance that this is a **soft inquiry** that **will not affect your CIBIL score** — this microcopy is not optional; it is a conversion-critical trust pattern specific to financial lead-gen forms, and it is also the single most legally load-bearing sentence in this entire flow (see §10). Never phrase it ambiguously ("won't hurt your credit" is vaguer and less defensible than "this is a soft inquiry and will not affect your CIBIL score").

**Accessibility notes:** Each step must announce its heading to screen readers on transition (so users aren't lost in a silent multi-step flow); PAN field needs input masking plus a visible "Secure" trust badge; income/currency fields need `inputmode="numeric"` for mobile keyboards; mobile-number field needs `inputmode="tel"` and should support the OTP-autofill pattern common on Android (`autocomplete="one-time-code"`).

**Common mistakes to avoid:** Never collect PAN, income, and address on a single dense screen — the linear one-topic-per-screen wizard exists specifically to reduce perceived risk/effort per step. Never omit the "soft inquiry, won't affect your CIBIL score" disclaimer near a credit-related field. Never let the error state be a dead end — always provide a "Return to cards" or equivalent recovery path. Never ask for Aadhaar number in this flow (see §10) — PAN is the correct and sufficient identifier for a card-eligibility check.

---

### 6.8 Author / Byline / Trust Blocks

**Purpose:** Establish editorial credibility — extremely prominent on this class of site, more so than most content sites, and especially important given the category-wide disclosure gap noted in §1.

**Structure (article byline, compact):**
`Written by: [Name], [Name] · Edited by: [Name] · Reviewed by: [Name] · Updated: [Date]`
— each name is a hyperlink to a full author bio page.

**Structure (category-page author block, expanded):** A full author card per contributor including headshot (circular avatar), name, title ("Cards & Rewards Senior Editor," "Points and Miles Expert Contributor"), an "Expertise" tag list, a "Highlights" bulleted credibility list, an "Experience" paragraph bio, a "Read more" link, and a link to "About our review board."

**"Why Trust [Site Name]" block:** An expandable (Show More/Less) section presenting stat callouts in the spirit of "300+ credit cards reviewed," "[X]+ years of combined editorial experience," "[X]+ hours spent researching MITC documents and fee schedules," "Independent, issuer-blind rating rubric" — each likely a large bold number + short label, arranged in a 2×2 or 4-across grid **[ESTIMATED]**. Exact figures should reflect the actual editorial operation at launch, not be invented placeholder numbers carried over from the source site.

**Sizing/typography:** Headshot ~64–80px circle **[ESTIMATED]**; name bold ~16px; title/role 13–14px `--color-text-secondary`; bio paragraph 14–15px `--leading-relaxed`.

**Color usage:** Entirely neutral — no special "trust" color coding; credibility is conveyed through content density and structure, not visual badging (aside from the stat-callout numerals which may use `--color-primary-blue` for emphasis).

**Accessibility notes:** Headshots need meaningful alt text (author's name), not generic "author photo."

**Common mistakes to avoid:** Don't compress the byline into a single anonymous "Staff" credit — the three-role structure (Written/Edited/Reviewed) is a deliberate, repeated trust signal and should never be simplified away.

---

### 6.9 Pros & Cons Block

**Purpose:** Balanced, scannable summary of a card's strengths and weaknesses — appears in nearly every review and card module.

**Structure:** Two-column layout (stacks to two sequential sections on mobile) under an H2/H3 "Pros" and "Cons" (or combined "What are the pros and cons?" parent header), each a simple bulleted list, 3–6 items typical.

**Typography/color:** Standard body list styling; **[ESTIMATED]** bullet markers may be colored (green check for pros, red/gray x or dash for cons), kept small and non-dominant so numbers/text remain primary.

**Common mistakes to avoid:** Never make "Cons" feel buried or smaller than "Pros" — balanced visual weight is core to the site's credibility positioning (it actively includes a "Why you might want a different card" section on nearly every review, reinforcing that this is not a pure sales page).

---

### 6.10 Sticky "Apply Now" Banner

**Purpose:** Persistent, dismissible top banner ensuring the primary conversion action is always available while reading long-form review content.

**Structure:** `[Close banner ×]  [Card thumbnail]  [Card Name]  [Apply Now — on Issuer's secure site]`

**Behavior:** Appears pinned to top of viewport (likely appears after scrolling past the hero, or is present from load and becomes sticky on scroll **[ESTIMATED]**); user-dismissible via explicit "Close banner" control, respecting the dismissal for the session.

**Color/sizing:** Compact height (~56–64px **[ESTIMATED]**), white or very light background, `--shadow-elevation-2` to lift it above content, primary button styling for Apply Now matching the main CTA button spec.

**Accessibility notes:** Must not permanently cover content (no unclosable sticky overlays); Close control needs an accessible label ("Close banner"). Must not steal focus on page load.

---

### 6.11 Footer

**Purpose:** Legal compliance, secondary navigation, brand social links, and final newsletter capture.

**Structure (top to bottom):**
1. **Newsletter signup band**: "Stay on top of new card launches and fee changes with our weekly newsletter." + email input + Subscribe button + privacy consent microcopy + success confirmation state.
2. **Logo + social icons** (X, Facebook, Instagram, YouTube — validate against actual channel presence at launch) under a "Follow us" label.
3. **Multi-column link groups**: Site (Privacy Policy, Cookie Settings, Terms of Use, Site Map) / About (Overview, Editorial Guidelines) / Contact (Customer Support, Partnership Opportunities, Media Relations, Contact Us) / Tools (Eligibility Checker, CIBIL Score Check).
4. **Copyright line**: "Copyright © [year] [Site Name]. All Rights Reserved."
5. **Full legal disclosure paragraphs** (see §10 for exact required content): Affiliate/Advertiser Disclosure, Editorial Independence Disclosure, CIBIL/Credit Information Disclosure — small, dense, muted-gray legal type, always present, never abbreviated or hidden behind an accordion in the footer (though a similar block **is** collapsible near the top of category pages via "Show More/Less").

**Typography/color:** Column headers small-caps or uppercase, bold, 12–13px; links 13–14px `--color-text-secondary`; legal paragraphs 11–12px `--color-text-muted`, tight line-height, clearly the lowest-priority/lowest-contrast text on the page — but never removed.

**Common mistakes to avoid:** Never omit the disclosure footer text when rebuilding any page template — see §1 and §10 for why this is a genuine differentiator in this category, not just boilerplate.

---

### 6.12 "As Seen On" Media Logo Strip

**Purpose:** Borrowed-authority trust signal via recognizable outlet logos.

**Structure:** Horizontal row of grayscale/muted logos **[ESTIMATED — logos typically desaturated to unify visual weight]**, equal height, evenly spaced, no borders/cards around individual logos, centered under an "As seen on:" label. Appears both directly under the homepage hero and again near the footer of every page.

**Publication list — needs explicit sourcing, not inheritance from the US original.** The source site's list (Wall Street Journal, Bloomberg, NYT, Fox Business) is entirely US-market and must not carry over. This is flagged as an open item in §13 rather than populated here with a guess, since using this component with fabricated or unverified press mentions would be a real problem — genuine earned coverage from outlets like Mint, Moneycontrol, LiveMint, Business Standard, or ET Wealth (whichever the site actually has) is a legitimate trust signal; an invented one is not.

**Mobile behavior:** Logos wrap to 2–3 per row or become a horizontally scrollable strip **[ESTIMATED]**.

---

### 6.13 Newsletter Signup Form

**Purpose:** Low-friction email capture, positioned as an editorial ("new launches, fee changes") rather than promotional ask.

**Structure:** Single email input + inline "Subscribe" button (side-by-side on desktop, stacked on mobile), consent microcopy linking Privacy Policy directly beneath, and an inline success-state message replacing the form after submit rather than a modal/toast **[ESTIMATED]**.

**Accessibility notes:** Success state must be announced via `aria-live="polite"` region since it replaces form content without a page navigation.

---

### 6.14 Badges / Score Tier Chips

**Purpose:** At-a-glance qualitative translation of a quantitative spec (turning "₹12,500 annual fee" into a colored "Premium" or "High" chip, or a "42% p.a." effective interest rate into "Standard").

**Structure:** Small pill or icon+label chip, one of five tiers: Excellent, Very Good, Good, Fair, Poor — implemented as small badge images or CSS-based icon+color combinations per tier (colored dot/ribbon plus the text label).

**Sizing:** Small, ~20–24px icon height **[ESTIMATED]**, inline with its row's label text.

**Color mapping:** Excellent = deep green, Very Good = mid green, Good = yellow-green, Fair = amber, Poor = red (see §3.1 semantic tokens).

**Accessibility notes:** Color must never be the only signal — the text label ("Excellent," "Fair") must always be present alongside the color, satisfying WCAG's "don't rely on color alone" requirement.

---

### 6.15 Filter & Sort Controls (Category Listing Pages)

**Purpose:** Let users narrow the recommendation list by feature, issuer, and CIBIL score range, and re-sort by rating/fee/interest rate.

**Structure:** Three stacked filter groups — "Filter by" (multi-select chip row: All cards, Lifetime Free, Cashback, Travel, Fuel, Dining, Airport Lounge Access, Student, Business, Low Interest), "Issuers" (dropdown select: All Issuers, HDFC Bank, SBI Card, ICICI Bank, Axis Bank, American Express — confirm final list against coverage at launch), "CIBIL Score Range" (dropdown select: All Ranges, 750+ (Excellent), 700–749 (Good), 650–699 (Fair), New to Credit / No Score) — plus a separate "Sort by" dropdown (Featured, Highest Rated, Lowest Interest Rate, Lowest Annual Fee).

**Empty state:** "No cards match your current filters. Try adjusting your filter settings to see more options." — plain centered text, no illustration, consistent with the site's utilitarian, non-decorative empty-state philosophy.

**Sizing/color:** Filter chips styled like the category pill strip (§6.2) — pill shape, light border, active state filled with `--color-primary-blue-light` background / `--color-primary-blue` text and border.

**Mobile behavior:** Filter chip row becomes horizontally scrollable; the two dropdown selects and sort control likely collapse into a single "Filters" button that opens a bottom sheet or full-screen filter panel **[ESTIMATED]**, standard mobile-commerce pattern.

**Accessibility notes:** Multi-select filter chips should be real checkboxes/toggle buttons with `aria-pressed`, not divs; dropdowns must be real `<select>` elements or fully-implemented ARIA comboboxes with keyboard support.

---

## 7. Accessibility

**Contrast ratios [ESTIMATED, targets]:** Body text (`#1A1A1A` on `#FFFFFF`) exceeds WCAG AAA (>15:1). Secondary/muted text (`#767676` on white) sits right around the WCAG AA minimum (~4.6:1) for normal text — treat `--color-text-muted` as a floor, never go lighter. Primary blue CTA text (white on `#0057B8`) should be verified ≥4.5:1 — a blue this dark comfortably clears AA for normal text and large text.

**Focus indicators:** Every interactive element (links, buttons, form fields, filter chips, accordion triggers, popover triggers) must show a visible `:focus-visible` outline — a 2px solid ring in primary blue with 2px offset is the safe default across the whole system. Never suppress `outline: none` without supplying a replacement.

**Keyboard navigation:** All mega-menu flyouts, card-module popovers ("More information" on ratings), accordions ("Show More/Less"), and the multi-step eligibility form must be fully operable without a mouse: Tab/Shift+Tab to move, Enter/Space to activate, Escape to close overlays, and focus must be returned sensibly (e.g., back to the trigger) when a popover/menu closes.

**Touch targets:** Minimum 44×44px **[ESTIMATED, WCAG 2.5.5 target]** for all buttons, checkboxes ("Add to compare"), and filter chips on touch viewports — particularly important given how many small interactive elements (info icons, close buttons, filter chips) are packed into card modules, and given the mobile-majority traffic expected here.

**ARIA expectations:** `aria-expanded` on all disclosure/accordion/menu triggers; `aria-live="polite"` on the newsletter success message and the eligibility-checker loading/error states; `role="alert"` or equivalent on form validation errors; real `<table>` semantics (never `<div>` grids) for all comparison tables; `aria-label` on icon-only buttons (close ×, chevron scroll arrows).

**Semantic HTML assumptions:** One `<h1>` per page (card name on review pages, category title on listing pages); logical `<h2>`/`<h3>` nesting matching the "On this page" anchor structure; `<nav>` landmarks for header nav, category pill strip, and footer link groups; `<main>` wrapping the primary content; breadcrumb as an ordered list within a `<nav aria-label="Breadcrumb">`.

**Reduced motion behavior:** Under `prefers-reduced-motion: reduce`, all slide/fade transitions on menus, accordions, and sticky-banner entrances should collapse to instant or near-instant (≤50ms opacity crossfade only) — no sliding, no parallax, ever, so this is a low-risk default to set globally.

**Language/locale attributes:** Even for an English-only v1, set `lang="en-IN"` (not bare `en`) on the document root, since this affects assistive-technology pronunciation and spell-check behavior and correctly signals the locale to browsers and search engines. If/when Hindi or regional-language pages ship, each page needs its own correct `lang` attribute, not a single sitewide value.

---

## 8. Design Philosophy — Deep Dive

**Why the design should feel trustworthy.** Trust should be manufactured through *redundant, unglamorous credibility signals* rather than visual polish alone: named authors with linked bios on every piece of content; a visible, repeated "our ratings aren't influenced by issuers" disclaimer directly inside the rating widget itself (not buried in a methodology page); a full legal disclosure block repeated on every single page footer; and a deliberately unexciting, non-salesy visual register (no countdown timers, no "limited time!!" red banners, no aggressive pop-ups). The absence of hype is itself the trust signal — this borrows the visual restraint of a research report, not a storefront. Given the disclosure gap identified across incumbent Indian comparison sites (§1), this isn't just inherited stylistic preference — it's a specific, checkable way this site can be more trustworthy than the category norm, and worth treating as a real editorial/product commitment rather than a design flourish.

**Why users should trust the recommendations.** Every recommendation should be bracketed by two mechanisms: a *quantified, decomposed rating* (not just a single star score, but sub-scores like "Welcome Benefit: 5.0" that let a skeptical reader audit the math) and a *deliberately unresolved counter-argument section* ("Why you might want a different card"). A page that argues against its own top recommendation reads as more credible than one that only argues for it — this is a rhetorical design pattern baked into the content template, not just a copywriting choice.

**How typography supports readability.** A single sans-serif family at generous line-height (1.5–1.7 for body) with strict, consistent heading hierarchy lets users skim a 2,000-word review in seconds by scanning bolded H2/H3s alone. The system deliberately avoids competing typographic voices (no serif display font, no script accents) because financial content benefits from feeling like one continuous, reliable narrator rather than a magazine layout with editorial "personality."

**How whitespace improves comprehension.** Dense financial facts (interest-rate tiers, fee schedules, reward categories) are inherently high-cognitive-load. The system compensates by giving each fact its own labeled row/line with real vertical breathing room rather than cramming specs into a compact spec-sheet grid — spacing *is* the parsing aid.

**How CTAs are emphasized.** "Apply Now" is the only button style used more than once, is always the highest-contrast filled element in its module, and is always paired with transparent trailing microcopy ("on [Issuer]'s secure site") that tells the user exactly what happens next. This combination — visual dominance plus honest expectation-setting — lets the CTA be aggressive in visibility without feeling manipulative in framing.

**How financial products are visually prioritized.** Card art (product photography) is one of the only places genuine color/imagery is allowed into an otherwise neutral system, making each card module's product image the natural eye-anchor. Numeric facts near that image (rating, fee, interest rate) borrow visual weight from proximity to the image rather than needing their own heavy styling.

**How editorial and commercial content should integrate.** By using the *identical* teaser-card template (image + eyebrow + title + byline + excerpt + link) for both a news/RBI-update article and a card-advice guide, the homepage visually asserts that commercial guidance and independent journalism are produced and presented with the same rigor.

---

## 9. Content & Editorial Patterns

- **Titles are literal and keyword-first**, optimized for both scanning and SEO: "Best Cashback Credit Cards of July 2026," "HDFC Regalia Gold Credit Card Review: Strong Value For Frequent Travelers." Include the month/year on "Best of" roundup titles and update them on a monthly cadence (visible via "Updated: [Date]" bylines) — India's card-fee and reward-program landscape changes fast enough (see the devaluation pattern flagged in §1's research) that a stale "Best of" page is a real credibility risk, not just an SEO staleness issue.
- **"In a Nutshell" / "Bottom Line" one-sentence summaries** appear near the top and bottom of every review — always a single, dense, benefit-plus-caveat sentence.
- **Tip callouts** are set off with a bold italic lead-in ("*Tip:*") inline within paragraphs rather than in a separate colored box — a lightweight, text-native callout convention rather than a heavy UI component.
- **"See related" cross-links** appear as their own small H3/bold line linking to a deep-dive comparison article (e.g., "HDFC Regalia Gold vs. Axis Atlas") — used to stitch the content graph together and keep users in the editorial ecosystem.
- **FAQ sections** close out most long-form pages, feeding an on-page anchor and likely FAQPage structured data for SEO.
- **"How we picked" methodology sections** close out roundup pages, reinforcing the rating widget's credibility claims with a full paragraph of process explanation.
- **Author "Expertise" tags and "Highlights" bullets** function like a mini résumé under every contributor — always 2–4 bullet credibility points, never a vague "loves writing about finance."
- **Fee-change/devaluation tracking is a first-class content type, not an afterthought.** Given how frequently Indian card programs change reward caps, redemption fees, and category-spend limits (per the independent research in §1), a review that doesn't flag recent changes reads as untrustworthy to an informed reader. Consider a standing "Recent changes to this card" callout, dated, near the top of every review — this is a genuine differentiation opportunity, not required scope for v1, but worth flagging as a content-model decision to make early since retrofitting it later means re-touching every review template.
- **Numerals in body copy follow the ₹/lakh-crore convention from §3.2** — this applies to editorial prose, not just tables and badges.

---

## 10. Trust, Compliance & Financial UI Patterns (India)

**This section is the one most likely to need legal review before shipping — see the provenance notice at the top of this document.** It's grounded in RBI's 2025 Master Directions on credit and debit card issuance and conduct, the MITC (Most Important Terms and Conditions) disclosure framework, and observed practice at BankBazaar/Paisabazaar, but it is not a substitute for a compliance sign-off, and RBI directions are amended frequently enough that specific figures/timelines below should be re-verified against rbi.org.in before this ships to production.

### 10.1 What replaces "Advertiser Disclosure"

The source site's small-caps "ADVERTISER DISCLOSURE" label has a real Indian-market equivalent, but it isn't a regulatory term — it's an FTC-driven US convention. India's regulatory disclosure obligation runs through the issuer (via MITC/Key Fact Statement), not through a comparison site. That means this site's disclosure serves a different, narrower purpose: disclosing the *commercial relationship between this site and the issuers it reviews*, which is a self-imposed editorial-ethics commitment, not an RBI mandate — and, per §1, a genuine point of differentiation given that Paisabazaar and BankBazaar do not prominently disclose their affiliate relationships on comparison pages.[^1]

Recommended label: **"AFFILIATE DISCLOSURE"** (small-caps, non-clickable static label, same placement as the source pattern — immediately below the nav, above the H1). Suggested content, to be run past legal/compliance before use verbatim:

> *"[Site name] may earn a commission from card issuers when you apply through links on this page. This does not influence which cards we review, how we rate them, or the order in which we present them. Our review team operates independently of our commercial partnerships. Full methodology: [link]."*

### 10.2 What replaces the FICO credit-range disclosure

The source site's footer includes a verbatim paragraph explaining that its credit ranges derive from FICO Score 8. **FICO does not apply in India.** The Indian equivalent is the **CIBIL score** (issued by TransUnion CIBIL, India's oldest and most widely referenced credit bureau), though CIBIL is one of **four RBI-licensed Credit Information Companies (CICs)** operating in India — the others are Experian, Equifax, and CRIF High Mark — and a rigorous disclosure should name CIBIL as the reference score used on this site while acknowledging it's one of several CICs, mirroring how the source site treats FICO as "one of many different types of credit scores."

Suggested footer paragraph, to be run past legal/compliance before use verbatim:

> *"[Site name]'s credit-score references are based on the CIBIL Score, issued by TransUnion CIBIL Limited, one of four credit information companies (CICs) licensed by the Reserve Bank of India. Other CICs — including Experian, Equifax, and CRIF High Mark — may generate different scores based on the same underlying credit history. A CIBIL score of 750 or above is generally considered good to excellent by most Indian card issuers; individual issuer criteria vary and this site's recommendations should not be read as a guarantee of approval."*

**On-card CIBIL-tier badges** (§6.14, §6.3 step 6) should use the score bands actually used by Indian issuers in eligibility marketing — roughly 750+ / 700–749 / 650–699 / below 650 or no history — rather than reusing the source site's FICO-derived tier language.

### 10.3 What replaces the CARD Act / Reg Z "See Rates and Fees" pattern

The source site's "See Rates and Fees" link — which routes to the issuer's legal terms page, satisfying US Truth in Lending Act / Reg Z / CARD Act disclosure-adjacency requirements — has a direct, well-defined Indian equivalent: the **MITC (Most Important Terms and Conditions)** document. Under RBI's Master Directions, card-issuers must provide a term-sheet containing the MITC, published and made available to customers, covering fees, interest calculation, billing, and grievance procedures, and this disclosure obligation is triggered at multiple stages — during marketing (fees and charges), at application (a Key Fact Statement covering fees, charges, and billing information), and in the welcome kit (the full MITC).[^2]

Practical implication for this component: rename "See Rates and Fees" to **"View Fees & MITC"** (§6.3, §6.5), and link it to the issuer's actual published MITC document for that card wherever available, rather than a generic terms page — this is both more useful to the reader and closer to the spirit of the source pattern's compliance purpose. Where a direct MITC link isn't available, link to the issuer's card-specific fees & charges page and label it accordingly rather than implying an MITC link that doesn't exist.

**"Terms Apply" microcopy** after superlative claims (bonus offers, milestone benefits) carries over unchanged in spirit — attach it directly to the claim, same line or immediately following, never relegated only to a footnote.

### 10.4 What replaces "Member FDIC"

The source site's "Member FDIC" trust marker doesn't map to a single equivalent — India's deposit-insurance body, DICGC (Deposit Insurance and Credit Guarantee Corporation), insures **deposits**, not credit-card liabilities, so it isn't the right marker for a credit-card-focused inline trust bullet. The closer equivalent trust markers for an Indian card-review context are:
- **The issuing bank's RBI-regulated status**, where relevant to reassure a first-time cardholder (e.g., "issued by a Scheduled Commercial Bank regulated by the RBI").
- **Card network badges** (Visa/Mastercard/RuPay/Amex) — genuinely useful in the Indian market in a way they aren't as differentiating in the US, since RBI's 2026 network-choice reforms mean issuers must now offer customers a choice of card network at issuance or renewal for large issuers, enhancing competitive pricing and letting users select network-specific benefits.[^3] Surfacing which networks a card is available on is more decision-relevant here than it was on the source site.

Do not invent an Indian-market "Member FDIC"-style badge that implies deposit-insurance-style protection on a credit product — that would be actively misleading.

### 10.5 Soft-pull / CIBIL-impact reassurance (highest-stakes copy in the system)

This is the direct localization of the source site's "won't impact your credit score" pattern, and it needs to be **more precise**, not just relabeled, because the underlying mechanism is well-documented and specific in the Indian context:

- Any eligibility-check or approval-odds tool on this site should perform a **soft inquiry only** — one that does not generate a hard inquiry record with any CIC and does not affect the user's CIBIL score. This must be true of the actual implementation, not just the copy; if the underlying data partner performs a hard pull, the UI must not claim otherwise.
- Place this reassurance **at the point of the relevant field** (§6.7, form step 7 and step 9), not just once at the top of the flow — carried over unchanged from the source pattern because it's a sound trust-UX principle independent of geography.
- Recommended phrasing: *"Checking your eligibility here is a soft inquiry and will not affect your CIBIL score."* Avoid vaguer phrasing like "won't hurt your credit" — "soft inquiry" and "CIBIL score" are the specific terms an informed Indian reader will recognize and trust; vaguer language reads as evasive to that same reader.
- If the site's *own* recommendation content (not the eligibility tool) discusses hard inquiries — e.g., explaining that applying directly with a bank triggers a hard inquiry — that content should also be accurate: a CIBIL score reflects factors including credit history and repayment behavior,[^4] and multiple hard inquiries in a short window are a commonly-cited (if often overstated in casual finance content) factor readers ask about. Don't overstate or understate this in review copy — link to a dedicated explainer rather than re-deriving the mechanism inline on every review.

### 10.6 PII collection in the eligibility-check flow

The source site's CardMatch-equivalent flow collects last-4-SSN as a US-specific identity field. **Do not carry this over as-is.** The correct Indian analog is **PAN (Permanent Account Number)** — India's tax-ID number, which issuers require for card applications regardless of comparison-site involvement. Do not substitute Aadhaar number for this purpose: Aadhaar has specific, narrower legally-sanctioned use cases for private-sector KYC than a general-purpose identity field, and using it here without the correct legal basis is a real risk, not just a UX preference — this is exactly the kind of thing that needs a compliance/legal check rather than a design-doc assumption, and is called out explicitly in §13.

Beyond PAN, the field list in §6.7 (name, address, employment, income, existing EMI obligations, mobile, email) mirrors the source site's structure because the *underlying trust-UX pattern* — one topic per screen, PII risk minimized by decomposition — is sound and geography-agnostic. What changed is which specific fields are collected and what they're called.

### 10.7 Grievance redressal — a component the source site doesn't need but this one does

RBI's regulatory framework gives Indian cardholders a **structured escalation path** — first to the issuer's own grievance process, then to the **RBI's Banking Ombudsman / Integrated Ombudsman Scheme** if unresolved — and RBI's Master Directions put real timelines behind this (e.g., provisional credit for disputed transactions within 10 days, full resolution within 30 days).[^3] The source site doesn't have a component for this because the US complaint-escalation landscape (CFPB, state AGs) isn't something a comparison site typically explains card-by-card.

This is worth adding as a genuinely new content pattern rather than skipping: a short, standard "What if something goes wrong with this card?" block (or FAQ entry) on every review, briefly explaining the issuer-first-then-Ombudsman escalation path in plain language. This is both a real service to readers and a trust-building pattern the incumbents in this category may not be doing well — but exact wording, timelines, and the Ombudsman contact/process details need compliance sign-off before publishing, since RBI's process details are specific and change; get this from RBI's current published guidance at time of build, not from this document.

### 10.8 Patterns that do NOT need localization

Worth being explicit about what transfers unchanged, so nothing gets over-localized:
- The MITC/Key-Fact-Statement disclosure-adjacency pattern (§10.3) is structurally identical in purpose to the source site's Reg Z pattern — same design slot, different link target and label.
- The soft-pull reassurance placement pattern (§10.5) is sound UX independent of jurisdiction.
- The balanced Pros/Cons and "why you might want a different card" counter-argument pattern (§8) isn't regulatory at all — it's an editorial-credibility device that works the same way in any market.
- The one-topic-per-screen form-wizard pattern (§6.7) is a general trust-UX principle, not a US-specific compliance requirement — it carries over because it's good design, not because RBI requires it.

### 10.9 One category-taxonomy correction worth flagging here

The source site's category pill strip includes "0% APR" as a top-level card category (§6.2, §2 principle 6). **This category doesn't translate cleanly.** Indian credit cards don't typically carry a marketed "0% purchase APR" period the way US cards do — promotional low/no-cost EMI conversion on specific purchases exists, but it's a transaction-level feature, not a card-level marketing category most Indian issuers lead with. Building a "0% APR Cards" landing page by directly translating the US category risk either an empty or misleading result set. Replace with **"Low Interest"** as the closest honest equivalent (already reflected in §6.2 and §6.15's category lists above), and treat any no-cost-EMI content as a feature explained within reviews, not a standalone top-level category, unless research at build time turns up enough genuine card-level 0%-APR-style products to justify one.

### 10.10 Sources for this section

Research citations for the claims made throughout §10, current as of this document's writing. RBI directions are amended frequently — re-verify against rbi.org.in before production use, per the provenance notice at the top of this document.

[^1]: HonestMoney.in, "Credit Card Comparison Tools India — Affiliate Bias Exposed, Honest Alternatives," May 2026.
[^2]: Paisabazaar, "RBI Credit Card MITC Rules & Guidelines Explained," and RBI (Non-Banking Financial Companies – Credit Cards: Issuance and Conduct) Directions, 2025, §85 (Contents of the MITC) and §B (Disclosure of the MITC), via taxguru.in.
[^3]: CreditLogic, "RBI New Credit Card Rules 2026 Explained: Fees, Limits, CIBIL Impact & Hidden Changes."
[^4]: BankBazaar, "CIBIL Report - How to Check & Download CIBIL Credit Report."

---

## 11. AI Replication Rules

**Always:**
- Always pair any numeric financial claim (fee, interest rate, reward rate, bonus) with bold or larger typographic weight relative to its label.
- Always give the primary "Apply Now" CTA the highest color contrast and largest fill of any element in its containing module.
- Always include an Affiliate Disclosure label near the top of any page and a full Editorial Independence + CIBIL/CIC disclosure block in the footer of every page (§10.1, §10.2).
- Always attribute recommendations/reviews to a named author with a linked bio, plus edited-by/reviewed-by where the template supports it.
- Always present Pros and Cons as two clearly separated, equally-weighted lists.
- Always include a counter-argument section ("Why you might want a different card," "Cons," "Alternatives") near any strong recommendation.
- Always use real semantic `<table>` markup for any side-by-side card or spec comparison.
- Always keep body text ≥16px and line-height ≥1.5 for long-form content.
- Always give every interactive element (including icon-only buttons) a visible focus state and an accessible name.
- Always use a single neutral sans-serif type family across headings and body — no serif/sans pairing, no display/script fonts — with an Indic-script-safe fallback in the stack (§3.2).
- Always keep the color palette to: neutrals (white/gray/charcoal) + one primary blue + a small green→red semantic tier scale reserved strictly for rating/score badges.
- Always format currency in ₹ with lakh/crore grouping (§3.2), and always place the soft-inquiry/CIBIL-safe reassurance at the point of the relevant form field, not just once at the top (§10.5).
- Always use PAN, never Aadhaar number, as the identity field in any eligibility/lead-gen form, absent an explicit, separately-verified legal basis for Aadhaar collection (§10.6, §13).

**Never:**
- Never use bright, saturated, "startup" colors (no purple, neon green, hot pink) anywhere in the system.
- Never use bouncy/scale/elastic animation on financial CTAs or rating numbers — motion stays limited to opacity/color transitions and simple slides.
- Never hide or shrink the disclosure/compliance text below a readable size or remove it from any page template to "clean up" the design.
- Never let a "Cons" or counter-argument section look visually subordinate (smaller text, lower contrast) to the "Pros"/recommendation section.
- Never rely on color alone to convey a rating tier — always keep the text label ("Excellent," "Fair") alongside any color-coded badge.
- Never make a mega-menu or comparison-relevant control hover-only with no click/tap/keyboard equivalent.
- Never collect sensitive form data (PAN, income, address) all on one screen — keep the one-topic-per-step wizard pattern for any lead-gen flow.
- Never let a multi-step form's error state be a dead end without a recovery link.
- Never use stock "5 gold stars" iconography as the *primary* rating signal — use a bold numeric score (x.x / 5) as primary, with stars as optional secondary reinforcement.
- Never introduce drop shadows heavier than the elevation-3 token, and never use colored/tinted shadows.
- Never carry over a US-specific regulatory claim (FICO, CARD Act, "Member FDIC," SSN) into this build without translating it through §10 first — none of those terms mean anything to an Indian user and some (especially an SSN-shaped field) would be actively confusing or wrong.
- Never invent specific press-mention logos, RBI-rule figures, or editorial-team stat callouts (§6.8, §6.12) to fill a component — leave a clearly marked placeholder and populate with real, verified content before launch.

**Prefer:**
- Prefer full-width, single-column, vertically-stacked recommendation modules over multi-column card grids for anything involving financial comparison — this format supports the dense, multi-field content each card module requires far better than a grid tile ever could.
- Prefer inline disclosure/accordion patterns ("More information" → expand in place) over modal dialogs for supplementary explanatory content (rating methodology, offer detail) — it keeps context and avoids interrupting the reading flow.
- Prefer plain-language, second-person, number-forward copy over adjective-heavy marketing copy.
- Prefer a `<select>`-based "Jump to" control for on-page navigation at narrow widths over a hidden hamburger anchor menu.
- Prefer linking "View Fees & MITC" to the issuer's actual card-specific MITC document over a generic terms page, wherever one is publicly available (§10.3).

**Avoid:**
- Avoid parallax scrolling, auto-playing carousels, or any motion the user didn't trigger.
- Avoid dense multi-column data grids on mobile without a horizontal-scroll or stacked-label fallback.
- Avoid decorative illustration or iconography that doesn't map to a specific function (no generic "finance" clipart, no abstract blob shapes).
- Avoid interrupting the reading flow with modal pop-ups on scroll or exit-intent — the sticky-but-dismissible top banner is the sanctioned pattern for persistent CTAs, not a modal overlay.
- Avoid heavy image/JS payloads on above-the-fold content, given the mobile/variable-network traffic profile expected here (§2, §5) — this is a firmer constraint on this build than it was on the source site.

**When uncertain:**
- When uncertain about an exact color value, default to the neutral/blue token set defined in §3.1 rather than inventing a new hue.
- When uncertain about spacing, default to the nearest value in the 4/8-based scale in §3.3 rather than an arbitrary pixel value.
- When uncertain whether a component needs a full modal or an inline disclosure, choose inline disclosure — it is the dominant pattern observed across ratings, offer details, and "Show More/Less" trust blocks.
- When uncertain whether to add motion, choose the simplest fade/opacity transition at `--duration-base` or omit motion entirely.
- When uncertain how to present a new financial data point, model it after the "At A Glance" label/value/badge pattern (§6.3, step 6) since it's the site's most reused data-presentation idiom.
- When uncertain about a compliance claim (an RBI rule, a timeline, a required disclosure sentence), do not guess or extrapolate from the US pattern — insert a clearly marked `[NEEDS LEGAL REVIEW]` placeholder and flag it, per the provenance notice at the top of this document.

**Use:**
- Use the numeric rating pattern (`x.x / 5`, with sub-score breakdown) for anything scoring a product.
- Use the byline pattern (Written by / Edited by / Reviewed by / Updated) for anything presented as advice or a recommendation.
- Use the tiered badge system (Excellent/Very Good/Good/Fair/Poor, green→red) only for translating a spec into a qualitative read, never as generic decoration.
- Use horizontally-scrollable pill rows for category-level navigation that needs to stay visible without wrapping.

**Do not:**
- Do not invent a mascot, illustrated character, or anthropomorphized brand element — this brand has none, and adding one would break tonal consistency.
- Do not add gamification elements (progress badges unrelated to form completion, streaks, confetti) — the only "game-like" element sanctioned by the source material is the neutral, functional multi-step form progress implied by Back/Next.
- Do not restyle the legal disclosure text to blend seamlessly with marketing copy — it should always read as a distinct, lower-emphasis, legally-toned block.

---

## 12. Component Checklist for Rebuilds

Use this as a pre-flight checklist before considering any page on this site "done":

- [ ] Header with logo, horizontally-scrollable nav row, and top-level mega-menu triggers (Eligibility Checker, Card Category, Card Issuer, CIBIL Score Range, Resources, Our Team)
- [ ] Affiliate Disclosure label near top of content
- [ ] Breadcrumb trail (if a detail/review page)
- [ ] H1 matching page purpose (card name, category name, or article title)
- [ ] Byline block with linked author(s), edited-by, reviewed-by, updated date (if editorial content)
- [ ] Primary "Apply Now" CTA present at least twice (top and bottom) if content is card-specific
- [ ] Numeric rating widget with expandable methodology disclosure (if reviewing a product)
- [ ] At-a-glance spec block with tiered color badges, using ₹/lakh-crore formatting (if reviewing a product)
- [ ] Pros/Cons two-column block (if reviewing a product)
- [ ] Counter-argument or "who shouldn't get this" section (if making a recommendation)
- [ ] Comparison table using real `<table>` markup (if comparing 2+ products)
- [ ] "On this page" anchor navigation for content over ~1,200 words
- [ ] FAQ section near the end (if content is a roundup or evergreen guide)
- [ ] "As seen on" media logo strip — only real, verified press mentions (§6.12, §13)
- [ ] Newsletter signup band before the footer
- [ ] Full footer: social links, multi-column link groups, copyright line, Affiliate Disclosure paragraph, Editorial Independence paragraph, CIBIL/CIC disclosure paragraph (§10.1, §10.2)
- [ ] "View Fees & MITC" link present and pointing to real issuer MITC/fee documentation, not a placeholder (§10.3)
- [ ] Soft-inquiry/CIBIL-safe reassurance present at every sensitive field in any lead-gen form, not just once at the top (§10.5)
- [ ] PAN (not SSN, not Aadhaar without separate legal basis) used as the identity field in any eligibility flow (§10.6)
- [ ] All interactive elements keyboard-operable with visible focus states
- [ ] All rating/tier badges paired with text labels, not color alone
- [ ] Mobile: nav collapses to hamburger/accordion, card modules single-column, tables scroll or stack, category pills scroll horizontally — and treat this as the primary tested configuration, not the fallback (§2)

---

## 13. Open Questions Before Build

Items flagged throughout this document that genuinely need a decision, source of truth, or legal sign-off before the corresponding section can be considered final — collected here so they aren't lost in the body text:

1. **Site name and eligibility-tool name.** This document uses "[Site name]" and a generic "eligibility-check tool" throughout (the functional equivalent of CardMatch™). Both need real names before copy can be finalized — see §6.1, §10.1.
2. **§10 compliance copy needs legal/compliance sign-off before shipping**, per the provenance notice at the top of this document — this includes the Affiliate Disclosure paragraph (§10.1), the CIBIL/CIC footer disclosure (§10.2), and especially the Grievance Redressal content pattern (§10.7), where specific Ombudsman process details and timelines need to come from current RBI guidance at build time, not from this document.
3. **Aadhaar vs. PAN in the eligibility flow (§10.6)** — this document takes the position that PAN is correct and Aadhaar should not be collected absent a separately-verified legal basis. This is a genuine compliance question (India's Aadhaar Act constrains private-sector use cases specifically) and deserves a direct legal answer, not an inference from this document.
4. **"As Seen On" media list (§6.12)** — needs real, sourced press mentions before this component ships. Candidates like Mint, Moneycontrol, LiveMint, Business Standard, or ET Wealth are plausible for this category but are not confirmed placements and must not be used as real logos until verified.
5. **Issuer and category taxonomy (§6.1, §6.2, §6.15)** — the issuer list and card-category list in this document are reasonable starting points based on major Indian issuers, but should be validated against the site's actual launch card coverage before being locked into navigation.
6. **Hindi/regional-language localization** — flagged as a roadmap consideration (§1, §3.2, §7) but explicitly out of v1 scope per this document. If it moves onto the roadmap, revisit line-height (§3.2), font stack testing with real Devanagari/Indic body copy, and per-page `lang` attributes (§7).
7. **Brand color extension** — §3.1 keeps the source site's blue-dominant palette unchanged per explicit direction. If a future brand exercise wants to explore a more distinctly Indian visual identity (which is a legitimate strategic question, not just a design one), that should be a deliberate branding decision made with its own research, not folded into this system doc.
8. **Editorial trust-block stat callouts (§6.8)** — the source pattern ("400+ cards reviewed," "80+ years combined experience") needs real numbers from the actual editorial operation at launch; placeholder figures should not go to production.

---

*End of DESIGN.md — adapted from a structural teardown of creditcards.com (homepage, Chase Sapphire Preferred review page, Best Rewards Credit Cards category page) for an Indian credit-card comparison platform. Structural/interaction patterns (§1–§9, most of §6) are largely format-agnostic and carry over with content changes only. Compliance content (§10) was rewritten from RBI Master Directions, MITC framework documentation, and current Indian card-comparison-site practice — treat as a well-reasoned starting point requiring legal/compliance review before production use, not as legal advice. Open items requiring further input are consolidated in §13.*
