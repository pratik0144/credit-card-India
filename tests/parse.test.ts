import { describe, it, expect } from 'vitest';
import {
  hasEstMarker,
  stripEst,
  isBlank,
  parseMoney,
  parsePercent,
  parseAgeRange,
  parseEditorialScore,
  parseCibil,
  parseNetwork,
  parseRewardType,
  parseContactlessUpi,
  parseFuelSurchargePct,
  parseLounge,
  parseEligibility,
  slugify,
  deriveCardSlug,
  mapContentCategories,
  deriveConfidence,
  estimateBaseRewardPer100,
  parseRewardCategories,
  parseBonuses,
  parseOffers,
  splitIncome,
  incomeBit,
} from '../scripts/lib/parse';

/* ================================================================== */
/* (est) detection                                                     */
/* ================================================================== */
describe('hasEstMarker', () => {
  it('detects (est) in strings', () => {
    expect(hasEstMarker('Visa (est)')).toBe(true);
    expect(hasEstMarker('750+ (estimated)')).toBe(true);
  });
  it('returns false for strings without markers', () => {
    expect(hasEstMarker('Visa')).toBe(false);
    expect(hasEstMarker(null)).toBe(false);
    expect(hasEstMarker(undefined)).toBe(false);
  });
});

describe('stripEst', () => {
  it('removes (est) and collapses whitespace', () => {
    expect(stripEst('Visa (est)')).toBe('Visa');
    expect(stripEst('750+ (estimated)')).toBe('750+');
  });
  it('returns empty string for null/undefined', () => {
    expect(stripEst(null)).toBe('');
    expect(stripEst(undefined)).toBe('');
  });
});

/* ================================================================== */
/* isBlank                                                             */
/* ================================================================== */
describe('isBlank', () => {
  it('detects null/undefined as blank', () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
  });
  it('detects N/A variants as blank', () => {
    expect(isBlank('N/A')).toBe(true);
    expect(isBlank('n/a')).toBe(true);
    expect(isBlank('Not Applicable')).toBe(true);
    expect(isBlank('Nil')).toBe(true);
    expect(isBlank('None')).toBe(true);
    expect(isBlank('-')).toBe(true);
    expect(isBlank('—')).toBe(true);
    expect(isBlank('TBD')).toBe(true);
  });
  it('considers regular text as non-blank', () => {
    expect(isBlank('Rs. 500')).toBe(false);
    expect(isBlank('Visa')).toBe(false);
  });
  it('strips (est) before checking', () => {
    expect(isBlank('N/A (est)')).toBe(true);
  });
});

/* ================================================================== */
/* parseMoney                                                          */
/* ================================================================== */
describe('parseMoney', () => {
  it('parses simple rupee amounts', () => {
    expect(parseMoney('Rs. 2500')).toBe(2500);
    expect(parseMoney('₹500')).toBe(500);
    expect(parseMoney('Rs. 0')).toBe(0);
  });

  it('handles Indian comma grouping', () => {
    expect(parseMoney('₹3,00,000')).toBe(300000);
    expect(parseMoney('₹1,00,00,000')).toBe(10000000);
  });

  it('handles Lakh shorthand', () => {
    expect(parseMoney('₹7.5 Lakhs')).toBe(750000);
    expect(parseMoney('2 Lakh')).toBe(200000);
    expect(parseMoney('Rs. 1.5 Lac')).toBe(150000);
  });

  it('handles Crore shorthand', () => {
    expect(parseMoney('1 Crore')).toBe(10000000);
    expect(parseMoney('₹2.5 Cr')).toBe(25000000);
  });

  it('returns 0 for "free" / "Nil" / "Lifetime Free"', () => {
    expect(parseMoney('Nil')).toBe(0);
    expect(parseMoney('Free')).toBe(0);
    expect(parseMoney('Lifetime Free')).toBe(0);
    expect(parseMoney('No annual fee')).toBe(0);
  });

  it('returns null for null/undefined/empty', () => {
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney(undefined)).toBeNull();
    expect(parseMoney('')).toBeNull();
  });

  it('extracts amount from verbose text', () => {
    expect(parseMoney('Rs. 999 (Verify on official site)')).toBe(999);
  });

  it('strips (est) before parsing', () => {
    expect(parseMoney('₹500 (est)')).toBe(500);
  });
});

/* ================================================================== */
/* parsePercent                                                        */
/* ================================================================== */
describe('parsePercent', () => {
  it('parses percentage values', () => {
    expect(parsePercent('3.5%')).toBe(3.5);
    expect(parsePercent('2% (est)')).toBe(2);
  });

  it('returns 0 for nil/waived', () => {
    expect(parsePercent('Nil')).toBe(0);
    expect(parsePercent('No markup')).toBe(0);
  });

  it('returns null for null/undefined', () => {
    expect(parsePercent(null)).toBeNull();
    expect(parsePercent(undefined)).toBeNull();
  });
});

/* ================================================================== */
/* parseAgeRange                                                       */
/* ================================================================== */
describe('parseAgeRange', () => {
  it('extracts min and max ages', () => {
    expect(parseAgeRange('21 - 65 years')).toEqual({ age_min: 21, age_max: 65 });
  });

  it('handles single age', () => {
    expect(parseAgeRange('21 years')).toEqual({ age_min: 21, age_max: null });
  });

  it('returns null for null/empty', () => {
    expect(parseAgeRange(null)).toEqual({ age_min: null, age_max: null });
    expect(parseAgeRange('')).toEqual({ age_min: null, age_max: null });
  });

  it('filters ages outside 18-80 range', () => {
    expect(parseAgeRange('Must be 21 years, limit 99')).toEqual({ age_min: 21, age_max: null });
  });
});

/* ================================================================== */
/* parseEditorialScore                                                 */
/* ================================================================== */
describe('parseEditorialScore', () => {
  it('parses x/10 to 5-point scale', () => {
    const result = parseEditorialScore('7.5/10');
    expect(result.editorial_score_raw).toBe('7.5/10');
    expect(result.editorial_score_5).toBe(3.8);
  });

  it('parses x/5 score', () => {
    const result = parseEditorialScore('4/5');
    expect(result.editorial_score_raw).toBe('4/5');
    expect(result.editorial_score_5).toBe(4.0);
  });

  it('returns null for null', () => {
    expect(parseEditorialScore(null)).toEqual({
      editorial_score_raw: null,
      editorial_score_5: null,
    });
  });

  it('returns raw with null score for unparseable text', () => {
    const result = parseEditorialScore('Excellent');
    expect(result.editorial_score_raw).toBe('Excellent');
    expect(result.editorial_score_5).toBeNull();
  });
});

/* ================================================================== */
/* parseCibil                                                          */
/* ================================================================== */
describe('parseCibil', () => {
  it('parses CIBIL score from text', () => {
    expect(parseCibil('750+')).toEqual({ cibil_min: 750, cibil_min_is_estimated: false });
  });

  it('detects estimated marker', () => {
    expect(parseCibil('750+ (est)')).toEqual({ cibil_min: 750, cibil_min_is_estimated: true });
  });

  it('returns null for secured/no-CIBIL products', () => {
    expect(parseCibil('No CIBIL required')).toEqual({
      cibil_min: null,
      cibil_min_is_estimated: false,
    });
    expect(parseCibil('FD-backed')).toEqual({
      cibil_min: null,
      cibil_min_is_estimated: false,
    });
  });

  it('returns null for null', () => {
    expect(parseCibil(null)).toEqual({ cibil_min: null, cibil_min_is_estimated: false });
  });
});

/* ================================================================== */
/* parseNetwork                                                        */
/* ================================================================== */
describe('parseNetwork', () => {
  it('parses Visa', () => {
    expect(parseNetwork('Visa')).toEqual({ network: 'visa', network_is_estimated: false });
  });

  it('parses Mastercard variants', () => {
    expect(parseNetwork('MasterCard World Elite')).toEqual({
      network: 'mastercard',
      network_is_estimated: false,
    });
    expect(parseNetwork('Master Card')).toEqual({
      network: 'mastercard',
      network_is_estimated: false,
    });
  });

  it('parses RuPay', () => {
    expect(parseNetwork('RuPay')).toEqual({ network: 'rupay', network_is_estimated: false });
  });

  it('parses American Express / Amex', () => {
    expect(parseNetwork('American Express')).toEqual({
      network: 'amex',
      network_is_estimated: false,
    });
    expect(parseNetwork('Amex')).toEqual({ network: 'amex', network_is_estimated: false });
  });

  it('parses Diners', () => {
    expect(parseNetwork('Diners Club')).toEqual({
      network: 'diners',
      network_is_estimated: false,
    });
  });

  it('picks the first network from multi-network strings', () => {
    const result = parseNetwork('Visa / Mastercard');
    expect(result.network).toBe('visa');
  });

  it('detects estimated marker', () => {
    expect(parseNetwork('Visa (est)')).toEqual({
      network: 'visa',
      network_is_estimated: true,
    });
  });

  it('returns null network for null', () => {
    expect(parseNetwork(null)).toEqual({ network: null, network_is_estimated: false });
  });
});

/* ================================================================== */
/* parseRewardType                                                     */
/* ================================================================== */
describe('parseRewardType', () => {
  it('detects cashback', () => {
    expect(parseRewardType('Cashback')).toBe('cashback');
    expect(parseRewardType('CashPoints')).toBe('cashback');
  });

  it('detects miles', () => {
    expect(parseRewardType('Miles')).toBe('miles');
    expect(parseRewardType('InterMiles')).toBe('miles');
  });

  it('detects points', () => {
    expect(parseRewardType('Reward Points')).toBe('points');
    expect(parseRewardType('NeuCoins')).toBe('points');
  });

  it('detects hybrid (multiple types)', () => {
    expect(parseRewardType('Points/Cashback')).toBe('hybrid');
  });

  it('returns null for null/empty', () => {
    expect(parseRewardType(null)).toBeNull();
    expect(parseRewardType('')).toBeNull();
  });
});

/* ================================================================== */
/* parseContactlessUpi                                                 */
/* ================================================================== */
describe('parseContactlessUpi', () => {
  it('detects contactless support', () => {
    const result = parseContactlessUpi('Yes, contactless');
    expect(result.supports_contactless).toBe(true);
  });

  it('detects UPI support', () => {
    const result = parseContactlessUpi('Contactless + UPI');
    expect(result.supports_contactless).toBe(true);
    expect(result.supports_upi).toBe(true);
  });

  it('returns null for null', () => {
    expect(parseContactlessUpi(null)).toEqual({
      supports_contactless: null,
      supports_upi: null,
    });
  });
});

/* ================================================================== */
/* parseFuelSurchargePct                                                */
/* ================================================================== */
describe('parseFuelSurchargePct', () => {
  it('extracts fuel surcharge waiver percentage', () => {
    expect(parseFuelSurchargePct('1% fuel surcharge waiver')).toBe(1);
    expect(parseFuelSurchargePct('2.5% surcharge waiver')).toBe(2.5);
  });

  it('returns null for null', () => {
    expect(parseFuelSurchargePct(null)).toBeNull();
  });
});

/* ================================================================== */
/* parseLounge                                                         */
/* ================================================================== */
describe('parseLounge', () => {
  it('parses per-year visits', () => {
    expect(parseLounge('4 complimentary visits per calendar year')).toEqual({
      visits_per_year: 4,
      network: null,
    });
  });

  it('parses per-quarter and annualizes', () => {
    expect(parseLounge('2 per quarter')).toEqual({
      visits_per_year: 8,
      network: null,
    });
  });

  it('parses per-month and annualizes', () => {
    expect(parseLounge('1 per month')).toEqual({
      visits_per_year: 12,
      network: null,
    });
  });

  it('returns 99 for "Unlimited"', () => {
    expect(parseLounge('Unlimited')).toEqual({
      visits_per_year: 99,
      network: null,
    });
  });

  it('returns 0 for blank/NA', () => {
    expect(parseLounge('N/A')).toEqual({ visits_per_year: 0, network: null });
    expect(parseLounge('Not Applicable')).toEqual({ visits_per_year: 0, network: null });
  });

  it('extracts network name', () => {
    const result = parseLounge('6 visits per year via Priority Pass');
    expect(result.visits_per_year).toBe(6);
    expect(result.network).toBe('Priority Pass');
  });

  it('extracts DreamFolks network', () => {
    const result = parseLounge('4 per year via DreamFolks');
    expect(result.visits_per_year).toBe(4);
    expect(result.network).toBe('DreamFolks');
  });

  it('returns null for null input', () => {
    expect(parseLounge(null)).toEqual({ visits_per_year: null, network: null });
  });
});

/* ================================================================== */
/* parseEligibility                                                    */
/* ================================================================== */
describe('parseEligibility', () => {
  it('parses salaried employment', () => {
    const rows = parseEligibility('Salaried', 'Rs. 25,000 per month');
    expect(rows).toHaveLength(1);
    expect(rows[0].employment_type).toBe('salaried');
    expect(rows[0].min_income_amount).toBe(25000);
    expect(rows[0].min_income_period).toBe('monthly');
  });

  it('parses self-employed employment', () => {
    const rows = parseEligibility('Self-employed', '₹5 Lakh per annum');
    expect(rows).toHaveLength(1);
    expect(rows[0].employment_type).toBe('self_employed');
    expect(rows[0].min_income_amount).toBe(500000);
    expect(rows[0].min_income_period).toBe('annual');
  });

  it('parses both salaried and self-employed', () => {
    const rows = parseEligibility('Salaried / Self-employed', 'Rs. 30,000 per month');
    expect(rows).toHaveLength(2);
    const types = rows.map((r) => r.employment_type).sort();
    expect(types).toEqual(['salaried', 'self_employed']);
  });

  it('defaults to "any" when no type is recognized', () => {
    const rows = parseEligibility('', '');
    expect(rows).toHaveLength(1);
    expect(rows[0].employment_type).toBe('any');
  });
});

/* ================================================================== */
/* slugify + deriveCardSlug                                            */
/* ================================================================== */
describe('slugify (parse.ts)', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('HDFC Bank')).toBe('hdfc-bank');
  });

  it('maps + to -plus for product differentiation', () => {
    expect(slugify('Air+')).toBe('air-plus');
    expect(slugify('Zenith+ Credit Card')).toBe('zenith-plus-credit-card');
  });

  it('removes special characters', () => {
    expect(slugify('Card (Gold)')).toBe('card-gold');
    expect(slugify('Super Premium!')).toBe('super-premium');
  });
});

describe('deriveCardSlug', () => {
  it('combines bank and card slug', () => {
    expect(deriveCardSlug('HDFC Bank', 'All Miles Credit Card')).toBe(
      'hdfc-bank-all-miles-credit-card',
    );
  });

  it('avoids doubling bank prefix', () => {
    expect(deriveCardSlug('HDFC Bank', 'HDFC Bank Regalia')).toBe('hdfc-bank-regalia');
  });
});

/* ================================================================== */
/* mapContentCategories                                                */
/* ================================================================== */
describe('mapContentCategories', () => {
  it('maps cashback text to cashback slug', () => {
    const result = mapContentCategories('Cashback');
    expect(result.slugs).toContain('cashback');
    expect(result.isDiscontinued).toBe(false);
  });

  it('maps travel text to travel slug', () => {
    const result = mapContentCategories('Travel & Miles');
    expect(result.slugs).toContain('travel');
  });

  it('detects discontinued cards', () => {
    const result = mapContentCategories('Rewards (Discontinued)');
    expect(result.isDiscontinued).toBe(true);
    expect(result.slugs).toContain('rewards');
  });

  it('adds lifetime-free for zero annual fee', () => {
    const result = mapContentCategories('Rewards', { annualFee: 0 });
    expect(result.slugs).toContain('lifetime-free');
    expect(result.slugs).toContain('rewards');
  });

  it('adds super-premium for premium tiers', () => {
    const result = mapContentCategories('Rewards', { tier: 'Visa Infinite' });
    expect(result.slugs).toContain('super-premium');
  });

  it('falls back to rewards when nothing matches', () => {
    const result = mapContentCategories('Unknown category xyz');
    expect(result.slugs).toContain('rewards');
  });

  it('falls back using reward type for cashback', () => {
    const result = mapContentCategories('', { rewardType: 'cashback' });
    expect(result.slugs).toContain('cashback');
  });

  it('maps multiple categories', () => {
    const result = mapContentCategories('Travel Lounge Dining');
    expect(result.slugs.length).toBeGreaterThanOrEqual(2);
    expect(result.slugs).toContain('travel');
    expect(result.slugs).toContain('dining');
    expect(result.slugs).toContain('airport-lounge');
  });
});

/* ================================================================== */
/* deriveConfidence                                                    */
/* ================================================================== */
describe('deriveConfidence', () => {
  it('returns verified when no fields are estimated', () => {
    const result = deriveConfidence({
      card_network: 'Visa',
      joining_fee: '₹500',
      annual_fee: '₹1000',
    });
    expect(result.data_confidence).toBe('verified');
    expect(result.estimated_fields).toEqual([]);
  });

  it('returns partially_estimated for some estimated fields', () => {
    const result = deriveConfidence({
      card_network: 'Visa (est)',
      joining_fee: '₹500',
      annual_fee: '₹1000',
      forex_markup: '3.5%',
    });
    expect(result.data_confidence).toBe('partially_estimated');
    expect(result.estimated_fields).toContain('network');
  });

  it('returns estimated when most fields are estimated', () => {
    const result = deriveConfidence({
      card_network: 'Visa (est)',
      joining_fee: '₹500 (est)',
      annual_fee: '₹1000 (est)',
    });
    expect(result.data_confidence).toBe('estimated');
    expect(result.estimated_fields.length).toBe(3);
  });
});

/* ================================================================== */
/* estimateBaseRewardPer100                                             */
/* ================================================================== */
describe('estimateBaseRewardPer100', () => {
  it('parses direct cashback percentage', () => {
    expect(estimateBaseRewardPer100('3.5%')).toBe(3.5);
  });

  it('parses points per spend pattern', () => {
    // 5 points for every ₹100 spent, ₹0.25 per point = 5 * 0.25 = ₹1.25/₹100
    const result = estimateBaseRewardPer100('5 reward points for every ₹100 spent');
    expect(result).toBeCloseTo(1.25, 1);
  });

  it('returns null for null/empty', () => {
    expect(estimateBaseRewardPer100(null)).toBeNull();
    expect(estimateBaseRewardPer100('')).toBeNull();
  });
});

/* ================================================================== */
/* parseRewardCategories                                               */
/* ================================================================== */
describe('parseRewardCategories', () => {
  it('always emits a general row from general rate', () => {
    const rows = parseRewardCategories(null, '1% cashback', 'cashback');
    expect(rows).toHaveLength(1);
    expect(rows[0].category_key).toBe('general');
    expect(rows[0].rate_pct).toBe(1);
  });

  it('parses semicolon-separated category-wise rates', () => {
    const rows = parseRewardCategories(
      'Groceries: 5X; Dining: 10X; Travel: 3X',
      '1X Reward Points',
      'points',
    );
    const keys = rows.map((r) => r.category_key);
    expect(keys).toContain('general');
    expect(keys).toContain('groceries');
    expect(keys).toContain('dining');
  });

  it('parses cashback percentage rates', () => {
    const rows = parseRewardCategories(
      '5% cashback on Amazon; 2% cashback on all spends',
      '1% cashback',
      'cashback',
    );
    const amazon = rows.find((r) => r.category_key === 'online_shopping');
    expect(amazon).toBeDefined();
    expect(amazon!.rate_pct).toBe(5);
  });

  it('excludes discount phrases from reward rates', () => {
    const rows = parseRewardCategories(
      '50% off on groceries',
      '1% cashback',
      'cashback',
    );
    // The "50% off" should NOT be treated as an earn rate
    const grocery = rows.find((r) => r.category_key === 'groceries');
    // Either no grocery row or the rate should not be 50
    if (grocery) {
      expect(grocery.rate_pct).not.toBe(50);
    }
  });

  it('caps reward percentage at 20%', () => {
    const rows = parseRewardCategories(
      '25% reward on dining',
      null,
      'cashback',
    );
    const dining = rows.find((r) => r.category_key === 'dining');
    // 25% should be excluded (capped at 20)
    if (dining) {
      expect(dining.rate_pct).toBeLessThanOrEqual(20);
    }
  });
});

/* ================================================================== */
/* parseBonuses                                                        */
/* ================================================================== */
describe('parseBonuses', () => {
  it('parses welcome bonus', () => {
    const rows = parseBonuses('Welcome bonus worth ₹5,000');
    expect(rows).toHaveLength(1);
    expect(rows[0].bonus_type).toBe('welcome');
    expect(rows[0].estimated_value_inr).toBe(5000);
  });

  it('parses milestone bonus with threshold', () => {
    const rows = parseBonuses('Milestone bonus on spending ₹2 Lakh');
    expect(rows).toHaveLength(1);
    expect(rows[0].bonus_type).toBe('milestone');
    expect(rows[0].threshold_spend_amount).toBe(200000);
  });

  it('parses anniversary bonus', () => {
    const rows = parseBonuses('Anniversary benefit of 5000 reward points');
    expect(rows).toHaveLength(1);
    expect(rows[0].bonus_type).toBe('anniversary');
  });

  it('returns empty for empty/null input', () => {
    expect(parseBonuses(null)).toEqual([]);
    expect(parseBonuses('')).toEqual([]);
  });

  it('handles multiple semicolon-separated bonuses', () => {
    const rows = parseBonuses('Welcome bonus ₹1,000; Milestone bonus on ₹5 Lakh spend');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const types = rows.map((r) => r.bonus_type);
    expect(types).toContain('welcome');
    expect(types).toContain('milestone');
  });
});

/* ================================================================== */
/* parseOffers                                                         */
/* ================================================================== */
describe('parseOffers', () => {
  it('splits offers on semicolons', () => {
    const rows = parseOffers('10% off on Amazon; 5% off on Flipkart');
    expect(rows.length).toBe(2);
  });

  it('assigns category from keywords', () => {
    const rows = parseOffers('Complimentary Swiggy membership');
    expect(rows).toHaveLength(1);
    expect(rows[0].category).toBe('dining');
  });

  it('returns empty for null/empty', () => {
    expect(parseOffers(null)).toEqual([]);
    expect(parseOffers('')).toEqual([]);
  });

  it('caps at 12 offers', () => {
    const long = Array.from({ length: 20 }, (_, i) => `Offer ${i + 1} on Amazon`).join('; ');
    const rows = parseOffers(long);
    expect(rows.length).toBeLessThanOrEqual(12);
  });
});

/* ================================================================== */
/* splitIncome + incomeBit                                              */
/* ================================================================== */
describe('splitIncome', () => {
  it('splits salaried and self-employed segments', () => {
    // The regex [^,;]*? stops at commas, so amounts need to be comma-free
    // or use lakh notation for the segment regex to match the number.
    const result = splitIncome('Salaried Rs.25000 per month; Self-employed ITR Rs.5 Lakh per annum');
    expect(result.salaried).toBeDefined();
    expect(result.selfEmployed).toBeDefined();
  });

  it('returns fallback for plain amount', () => {
    const result = splitIncome('₹30,000 per month');
    expect(result.fallback).toBeDefined();
    expect(result.fallback!.amount).toBe(30000);
    expect(result.fallback!.period).toBe('monthly');
  });

  it('returns empty for blank input', () => {
    expect(splitIncome('')).toEqual({});
    expect(splitIncome('N/A')).toEqual({});
  });
});

describe('incomeBit', () => {
  it('parses monthly income', () => {
    const result = incomeBit('₹25,000 per month');
    expect(result).toBeDefined();
    expect(result!.amount).toBe(25000);
    expect(result!.period).toBe('monthly');
  });

  it('parses annual income with Lakh', () => {
    const result = incomeBit('₹5 Lakh per annum');
    expect(result).toBeDefined();
    expect(result!.amount).toBe(500000);
    expect(result!.period).toBe('annual');
  });

  it('returns null for no numbers', () => {
    expect(incomeBit('Not available')).toBeNull();
  });
});
