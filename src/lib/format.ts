/*
 * Formatting helpers. The ₹/lakh-crore rule (DESIGN.md §3.2) is a hard
 * reading-comprehension requirement, not a nicety: use ₹ (never "Rs."/"INR")
 * and Indian digit grouping ("₹3,00,000" not "₹300,000") everywhere — tables,
 * badges, and prose. Never mix grouping conventions on one page.
 */

/** Format a number with Indian (lakh/crore) grouping, no currency symbol. */
export function groupIndian(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}

/** Format an amount as ₹ with lakh/crore grouping. `null`/undefined → em dash. */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return `₹${groupIndian(amount)}`;
}

/**
 * Compact ₹ for large figures using lakh/crore words where it aids scanning
 * (e.g. fee-waiver thresholds). ₹3,00,000 → "₹3 lakh", ₹1,00,00,000 → "₹1 crore".
 */
export function formatINRCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  if (amount >= 1_00_00_000) return `₹${trimZero(amount / 1_00_00_000)} crore`;
  if (amount >= 1_00_000) return `₹${trimZero(amount / 1_00_000)} lakh`;
  return `₹${groupIndian(amount)}`;
}

function trimZero(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '');
}

/** "Lifetime Free" when annual fee is 0; else formatted ₹. */
export function formatAnnualFee(amount: number | null | undefined): string {
  if (amount === 0) return 'Lifetime Free';
  return formatINR(amount);
}

/** Slugify a string for URLs (bank/card/category slugs). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Current "Month Year" for "Best of" titles (§9 SEO — must be real, not decorative). */
export function currentMonthYear(date = new Date()): string {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/** "x.x / 5" rating display; null → "Not yet rated". */
export function formatRating(score: number | null | undefined): string {
  if (score === null || score === undefined) return 'Not yet rated';
  return `${score.toFixed(1)} / 5`;
}
