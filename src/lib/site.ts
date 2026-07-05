/*
 * Site-wide constants. NOTE: the site name and eligibility-tool name are
 * OPEN QUESTIONS (DESIGN.md §13.1) — "CardCompare.in" is a working placeholder,
 * not final branding. Centralised here so a rename is a one-line change.
 */
export const SITE = {
  name: 'CardCompare.in', // [PLACEHOLDER — see DESIGN.md §13.1]
  domain: 'cardcompare.in',
  url: 'https://cardcompare.in',
  lang: 'en-IN', // DESIGN.md §7 — never bare "en"
  tagline: 'Independent credit-card reviews and comparisons for India',
  eligibilityToolName: 'Check My Eligibility', // [PLACEHOLDER — CardMatch equivalent, §13.1]
} as const;

/* Issuer list for nav/footer — validate against launch coverage (§13.5). */
export const FEATURED_ISSUERS = [
  'HDFC Bank', 'SBI Card', 'ICICI Bank', 'Axis Bank', 'American Express',
  'IDFC FIRST Bank', 'Kotak Mahindra Bank', 'YES Bank', 'IndusInd Bank', 'RBL Bank',
] as const;
