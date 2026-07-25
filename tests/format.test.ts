import { describe, it, expect } from 'vitest';
import {
  groupIndian,
  formatINR,
  formatINRCompact,
  formatAnnualFee,
  slugify,
  currentMonthYear,
  formatRating,
  formatLounge,
} from '../src/lib/format';

/* ------------------------------------------------------------------ */
/* groupIndian                                                         */
/* ------------------------------------------------------------------ */
describe('groupIndian', () => {
  it('formats small numbers without grouping', () => {
    expect(groupIndian(0)).toBe('0');
    expect(groupIndian(999)).toBe('999');
  });

  it('formats thousands with Indian grouping', () => {
    expect(groupIndian(1000)).toBe('1,000');
    expect(groupIndian(50000)).toBe('50,000');
  });

  it('formats lakhs with Indian grouping', () => {
    expect(groupIndian(100000)).toBe('1,00,000');
    expect(groupIndian(300000)).toBe('3,00,000');
    expect(groupIndian(750000)).toBe('7,50,000');
  });

  it('formats crores with Indian grouping', () => {
    expect(groupIndian(10000000)).toBe('1,00,00,000');
    expect(groupIndian(25000000)).toBe('2,50,00,000');
  });

  it('rounds decimals', () => {
    expect(groupIndian(1234.56)).toBe('1,235');
    expect(groupIndian(99.4)).toBe('99');
  });
});

/* ------------------------------------------------------------------ */
/* formatINR                                                           */
/* ------------------------------------------------------------------ */
describe('formatINR', () => {
  it('prefixes with ₹ and uses Indian grouping', () => {
    expect(formatINR(500)).toBe('₹500');
    expect(formatINR(100000)).toBe('₹1,00,000');
    expect(formatINR(0)).toBe('₹0');
  });

  it('returns em dash for null/undefined/NaN', () => {
    expect(formatINR(null)).toBe('-');
    expect(formatINR(undefined)).toBe('-');
    expect(formatINR(NaN)).toBe('-');
  });
});

/* ------------------------------------------------------------------ */
/* formatINRCompact                                                    */
/* ------------------------------------------------------------------ */
describe('formatINRCompact', () => {
  it('returns em dash for null/undefined/NaN', () => {
    expect(formatINRCompact(null)).toBe('-');
    expect(formatINRCompact(undefined)).toBe('-');
    expect(formatINRCompact(NaN)).toBe('-');
  });

  it('formats values below 1 lakh normally', () => {
    expect(formatINRCompact(50000)).toBe('₹50,000');
    expect(formatINRCompact(999)).toBe('₹999');
  });

  it('formats lakhs with "lakh" word', () => {
    expect(formatINRCompact(100000)).toBe('₹1 lakh');
    expect(formatINRCompact(300000)).toBe('₹3 lakh');
    expect(formatINRCompact(750000)).toBe('₹7.5 lakh');
  });

  it('formats crores with "crore" word', () => {
    expect(formatINRCompact(10000000)).toBe('₹1 crore');
    expect(formatINRCompact(25000000)).toBe('₹2.5 crore');
  });

  it('trims trailing zeros on compact values', () => {
    expect(formatINRCompact(200000)).toBe('₹2 lakh');
    expect(formatINRCompact(500000)).toBe('₹5 lakh');
  });
});

/* ------------------------------------------------------------------ */
/* formatAnnualFee                                                     */
/* ------------------------------------------------------------------ */
describe('formatAnnualFee', () => {
  it('returns "Lifetime Free" for 0', () => {
    expect(formatAnnualFee(0)).toBe('Lifetime Free');
  });

  it('formats non-zero fees with ₹', () => {
    expect(formatAnnualFee(500)).toBe('₹500');
    expect(formatAnnualFee(10000)).toBe('₹10,000');
  });

  it('returns em dash for null/undefined', () => {
    expect(formatAnnualFee(null)).toBe('-');
    expect(formatAnnualFee(undefined)).toBe('-');
  });
});

/* ------------------------------------------------------------------ */
/* slugify                                                             */
/* ------------------------------------------------------------------ */
describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('HDFC Bank')).toBe('hdfc-bank');
  });

  it('replaces & with "and"', () => {
    expect(slugify('Travel & Rewards')).toBe('travel-and-rewards');
  });

  it('strips special characters', () => {
    expect(slugify('Super Premium!')).toBe('super-premium');
    expect(slugify('Card (Gold)')).toBe('card-gold');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  --test--  ')).toBe('test');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('a   b   c')).toBe('a-b-c');
  });
});

/* ------------------------------------------------------------------ */
/* currentMonthYear                                                    */
/* ------------------------------------------------------------------ */
describe('currentMonthYear', () => {
  it('formats a known date', () => {
    const result = currentMonthYear(new Date('2026-07-15'));
    expect(result).toBe('July 2026');
  });

  it('formats January correctly', () => {
    const result = currentMonthYear(new Date('2027-01-01'));
    expect(result).toBe('January 2027');
  });
});

/* ------------------------------------------------------------------ */
/* formatRating                                                        */
/* ------------------------------------------------------------------ */
describe('formatRating', () => {
  it('formats a numeric rating as x.x / 5', () => {
    expect(formatRating(4.2)).toBe('4.2 / 5');
    expect(formatRating(5)).toBe('5.0 / 5');
    expect(formatRating(0)).toBe('0.0 / 5');
  });

  it('returns "Not yet rated" for null/undefined', () => {
    expect(formatRating(null)).toBe('Not yet rated');
    expect(formatRating(undefined)).toBe('Not yet rated');
  });
});

/* ------------------------------------------------------------------ */
/* formatLounge                                                        */
/* ------------------------------------------------------------------ */
describe('formatLounge', () => {
  it('returns "-" for null/undefined', () => {
    expect(formatLounge(null)).toBe('-');
    expect(formatLounge(undefined)).toBe('-');
  });

  it('returns "None" for 0', () => {
    expect(formatLounge(0)).toBe('None');
  });

  it('returns "Unlimited" for 99 (sentinel)', () => {
    expect(formatLounge(99)).toBe('Unlimited');
    expect(formatLounge(100)).toBe('Unlimited');
  });

  it('returns the number as string for normal values', () => {
    expect(formatLounge(4)).toBe('4');
    expect(formatLounge(12)).toBe('12');
  });
});
