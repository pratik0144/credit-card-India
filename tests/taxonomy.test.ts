import { describe, it, expect } from 'vitest';
import { SITE, FEATURED_ISSUERS } from '../src/lib/site';
import {
  SPEND_CATEGORY_KEYS,
  SPEND_CATEGORY_LABELS,
  CONTENT_CATEGORIES,
  GOALS,
  MONTHLY_SPEND_BANDS,
  AIR_TRAVEL_FREQ,
  EMPLOYMENT_TYPES,
  ANNUAL_INCOME_BANDS,
  CIBIL_BANDS,
  FEE_PREFERENCES,
  MONTHLY_SPEND_MIDPOINT,
  ANNUAL_INCOME_FLOOR,
  CIBIL_BAND_FLOOR,
} from '../src/lib/taxonomy';

/* ================================================================== */
/* Site config                                                         */
/* ================================================================== */
describe('SITE config', () => {
  it('has required properties', () => {
    expect(SITE.name).toBe('CardCompare.in');
    expect(SITE.domain).toBe('cardcompare.in');
    expect(SITE.url).toBe('https://cardcompare.in');
    expect(SITE.lang).toBe('en-IN');
    expect(SITE.tagline).toBeTruthy();
    expect(SITE.eligibilityToolName).toBeTruthy();
  });

  it('URL is HTTPS', () => {
    expect(SITE.url).toMatch(/^https:\/\//);
  });

  it('lang is en-IN, not bare "en"', () => {
    expect(SITE.lang).toBe('en-IN');
  });
});

describe('FEATURED_ISSUERS', () => {
  it('contains at least 5 major banks', () => {
    expect(FEATURED_ISSUERS.length).toBeGreaterThanOrEqual(5);
  });

  it('includes HDFC Bank and SBI Card', () => {
    expect(FEATURED_ISSUERS).toContain('HDFC Bank');
    expect(FEATURED_ISSUERS).toContain('SBI Card');
  });
});

/* ================================================================== */
/* Taxonomy — spend categories                                         */
/* ================================================================== */
describe('SPEND_CATEGORY_KEYS', () => {
  it('has 11 canonical spend categories', () => {
    expect(SPEND_CATEGORY_KEYS).toHaveLength(11);
  });

  it('includes "general" as first key', () => {
    expect(SPEND_CATEGORY_KEYS[0]).toBe('general');
  });

  it('includes all expected categories', () => {
    expect(SPEND_CATEGORY_KEYS).toContain('groceries');
    expect(SPEND_CATEGORY_KEYS).toContain('dining');
    expect(SPEND_CATEGORY_KEYS).toContain('fuel');
    expect(SPEND_CATEGORY_KEYS).toContain('online_shopping');
    expect(SPEND_CATEGORY_KEYS).toContain('travel_flights');
    expect(SPEND_CATEGORY_KEYS).toContain('travel_hotels');
  });

  it('has a label for every key', () => {
    for (const key of SPEND_CATEGORY_KEYS) {
      expect(SPEND_CATEGORY_LABELS[key]).toBeTruthy();
    }
  });
});

/* ================================================================== */
/* Taxonomy — content categories                                       */
/* ================================================================== */
describe('CONTENT_CATEGORIES', () => {
  it('has 12 content categories', () => {
    expect(CONTENT_CATEGORIES).toHaveLength(12);
  });

  it('each has a slug and name', () => {
    for (const cat of CONTENT_CATEGORIES) {
      expect(cat.slug).toBeTruthy();
      expect(cat.name).toBeTruthy();
    }
  });

  it('slugs are URL-safe (lowercase, hyphenated)', () => {
    for (const cat of CONTENT_CATEGORIES) {
      expect(cat.slug).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('does NOT contain "0% APR" (use "Low Interest" per design spec)', () => {
    const slugs = CONTENT_CATEGORIES.map((c) => c.slug);
    const names = CONTENT_CATEGORIES.map((c) => c.name);
    expect(slugs).not.toContain('0-apr');
    expect(names.some((n) => n.includes('0%'))).toBe(false);
  });
});

/* ================================================================== */
/* Taxonomy — quiz / recommendation enums                              */
/* ================================================================== */
describe('Quiz enums', () => {
  it('GOALS has at least 5 options', () => {
    expect(GOALS.length).toBeGreaterThanOrEqual(5);
    expect(GOALS).toContain('cashback');
    expect(GOALS).toContain('travel_miles');
    expect(GOALS).toContain('first_card');
  });

  it('MONTHLY_SPEND_BANDS has 5 bands', () => {
    expect(MONTHLY_SPEND_BANDS).toHaveLength(5);
    expect(MONTHLY_SPEND_BANDS).toContain('lt20k');
    expect(MONTHLY_SPEND_BANDS).toContain('3l_plus');
  });

  it('AIR_TRAVEL_FREQ has 4 options', () => {
    expect(AIR_TRAVEL_FREQ).toHaveLength(4);
    expect(AIR_TRAVEL_FREQ).toContain('never');
    expect(AIR_TRAVEL_FREQ).toContain('7_plus_year');
  });

  it('EMPLOYMENT_TYPES has 4 types', () => {
    expect(EMPLOYMENT_TYPES).toHaveLength(4);
    expect(EMPLOYMENT_TYPES).toContain('salaried');
    expect(EMPLOYMENT_TYPES).toContain('self_employed');
    expect(EMPLOYMENT_TYPES).toContain('student');
  });

  it('ANNUAL_INCOME_BANDS has 5 bands', () => {
    expect(ANNUAL_INCOME_BANDS).toHaveLength(5);
    expect(ANNUAL_INCOME_BANDS).toContain('lt3l');
    expect(ANNUAL_INCOME_BANDS).toContain('25l_plus');
  });

  it('CIBIL_BANDS has 5 bands including not_sure', () => {
    expect(CIBIL_BANDS).toHaveLength(5);
    expect(CIBIL_BANDS).toContain('750_plus');
    expect(CIBIL_BANDS).toContain('not_sure');
    expect(CIBIL_BANDS).toContain('new_to_credit');
  });

  it('FEE_PREFERENCES has 3 options', () => {
    expect(FEE_PREFERENCES).toHaveLength(3);
    expect(FEE_PREFERENCES).toContain('lifetime_free_only');
    expect(FEE_PREFERENCES).toContain('no_preference');
  });
});

/* ================================================================== */
/* Taxonomy — band floors/midpoints (scoring math)                     */
/* ================================================================== */
describe('Band numeric mappings', () => {
  it('MONTHLY_SPEND_MIDPOINT has a value for every band', () => {
    for (const band of MONTHLY_SPEND_BANDS) {
      expect(MONTHLY_SPEND_MIDPOINT[band]).toBeDefined();
      expect(MONTHLY_SPEND_MIDPOINT[band]).toBeGreaterThanOrEqual(0);
    }
  });

  it('MONTHLY_SPEND_MIDPOINT values increase monotonically', () => {
    const values = MONTHLY_SPEND_BANDS.map((b) => MONTHLY_SPEND_MIDPOINT[b]);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('ANNUAL_INCOME_FLOOR has a value for every band', () => {
    for (const band of ANNUAL_INCOME_BANDS) {
      expect(ANNUAL_INCOME_FLOOR[band]).toBeDefined();
      expect(ANNUAL_INCOME_FLOOR[band]).toBeGreaterThanOrEqual(0);
    }
  });

  it('ANNUAL_INCOME_FLOOR values increase monotonically', () => {
    const values = ANNUAL_INCOME_BANDS.map((b) => ANNUAL_INCOME_FLOOR[b]);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('CIBIL_BAND_FLOOR has correct scores', () => {
    expect(CIBIL_BAND_FLOOR['750_plus']).toBe(750);
    expect(CIBIL_BAND_FLOOR['700_749']).toBe(700);
    expect(CIBIL_BAND_FLOOR['650_699']).toBe(650);
  });
});
