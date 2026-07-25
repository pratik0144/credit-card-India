import { describe, it, expect } from 'vitest';
import {
  breadcrumbList,
  financialProduct,
  faqPage,
  articleSchema,
  organizationSchema,
  webSiteSchema,
} from '../src/lib/seo';
import type { Card, Bank, CardRating } from '../src/lib/database.types';

/* ---- Test fixtures ---- */
const mockCard: Card = {
  id: 'card-1',
  bank_id: 'bank-1',
  name: 'HDFC Regalia Gold',
  slug: 'hdfc-bank-regalia-gold',
  bank_name: 'HDFC Bank',
  bank_slug: 'hdfc-bank',
  card_type: 'credit',
  network: 'visa',
  tier: 'Gold',
  reward_type: 'points',
  annual_fee_amount: 2500,
  joining_fee_amount: 2500,
  annual_fee_waiver_spend_amount: 300000,
  base_reward_value_inr_per_100: 1.5,
  reward_rate_general_text: '4 Reward Points per ₹150',
  forex_markup_pct: 2,
  lounge_domestic_visits_per_year: 12,
  lounge_intl_visits_per_year: 6,
  lounge_intl_network: 'Priority Pass',
  fuel_surcharge_waiver_text: '1% fuel surcharge waiver',
  cibil_min: 750,
  editorial_score_5: 4.2,
  data_confidence: 'verified',
  is_active: true,
  image_url: '/card-img/hdfc-regalia-gold.png',
  reward_rate_category_wise: null,
  all_bonus: null,
  all_offers: null,
  cibil_min_is_estimated: false,
  estimated_fields: [],
  apply_url: 'https://hdfc.example.com/apply',
  created_at: '2026-01-01',
  updated_at: '2026-07-01',
};

const mockBank: Bank = {
  id: 'bank-1',
  name: 'HDFC Bank',
  slug: 'hdfc-bank',
  logo_url: null,
  website_url: 'https://hdfcbank.com',
  created_at: '2026-01-01',
};

const mockRating: CardRating = {
  card_id: 'card-1',
  overall_score: 4.2,
  rewards_score: 4.5,
  fees_score: 3.5,
  welcome_score: 4.0,
  flexibility_score: 4.0,
  service_score: 4.0,
  methodology_note: null,
  updated_at: '2026-07-01',
};

/* ================================================================== */
/* breadcrumbList                                                      */
/* ================================================================== */
describe('breadcrumbList', () => {
  it('generates valid BreadcrumbList JSON-LD', () => {
    const result = breadcrumbList([
      { name: 'Home', path: '/' },
      { name: 'Banks', path: '/banks' },
      { name: 'HDFC Bank', path: '/banks/hdfc-bank' },
    ]);
    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('BreadcrumbList');
    const items = result.itemListElement as any[];
    expect(items).toHaveLength(3);
    expect(items[0].position).toBe(1);
    expect(items[0].name).toBe('Home');
    expect(items[2].position).toBe(3);
    expect(items[2].name).toBe('HDFC Bank');
  });

  it('generates full URLs from paths', () => {
    const result = breadcrumbList([{ name: 'Cards', path: '/cards' }]);
    const items = result.itemListElement as any[];
    expect(items[0].item).toBe('https://cardcompare.in/cards');
  });
});

/* ================================================================== */
/* financialProduct                                                    */
/* ================================================================== */
describe('financialProduct', () => {
  it('generates FinancialProduct JSON-LD', () => {
    const result = financialProduct(mockCard, mockBank, mockRating, '/cards/hdfc-bank/regalia-gold');
    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('FinancialProduct');
    expect(result.name).toBe('HDFC Regalia Gold');
    expect(result.category).toBe('Credit Card');
    expect(result.url).toBe('https://cardcompare.in/cards/hdfc-bank/regalia-gold');
  });

  it('includes brand as BankOrCreditUnion', () => {
    const result = financialProduct(mockCard, mockBank, mockRating, '/cards/hdfc-bank/regalia-gold');
    const brand = result.brand as any;
    expect(brand['@type']).toBe('BankOrCreditUnion');
    expect(brand.name).toBe('HDFC Bank');
  });

  it('includes fee specification', () => {
    const result = financialProduct(mockCard, mockBank, mockRating, '/cards/hdfc-bank/regalia-gold');
    expect(result.feesAndCommissionsSpecification).toBe('Annual fee: ₹2,500');
  });

  it('includes aggregate rating when available', () => {
    const result = financialProduct(mockCard, mockBank, mockRating, '/cards/hdfc-bank/regalia-gold');
    const rating = result.aggregateRating as any;
    expect(rating['@type']).toBe('AggregateRating');
    expect(rating.ratingValue).toBe(4.2);
    expect(rating.bestRating).toBe(5);
  });

  it('omits aggregate rating when null', () => {
    const result = financialProduct(mockCard, mockBank, null, '/cards/hdfc-bank/regalia-gold');
    expect(result.aggregateRating).toBeUndefined();
  });

  it('includes image when available', () => {
    const result = financialProduct(mockCard, mockBank, null, '/cards/hdfc-bank/regalia-gold');
    expect(result.image).toBe('/card-img/hdfc-regalia-gold.png');
  });
});

/* ================================================================== */
/* faqPage                                                             */
/* ================================================================== */
describe('faqPage', () => {
  it('generates FAQPage JSON-LD', () => {
    const result = faqPage([
      { q: 'What is the annual fee?', a: '₹2,500' },
      { q: 'Is it lifetime free?', a: 'No, but fee waiver is available.' },
    ]);
    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('FAQPage');
    const entities = result.mainEntity as any[];
    expect(entities).toHaveLength(2);
    expect(entities[0]['@type']).toBe('Question');
    expect(entities[0].name).toBe('What is the annual fee?');
    expect(entities[0].acceptedAnswer['@type']).toBe('Answer');
    expect(entities[0].acceptedAnswer.text).toBe('₹2,500');
  });
});

/* ================================================================== */
/* articleSchema                                                       */
/* ================================================================== */
describe('articleSchema', () => {
  it('generates Article JSON-LD', () => {
    const result = articleSchema({
      title: 'Best Travel Cards 2026',
      description: 'Top travel credit cards in India',
      path: '/guides/best-travel-cards',
      author: 'Pratik Potadar',
      published: '2026-07-01',
      updated: '2026-07-25',
    });
    expect(result['@type']).toBe('Article');
    expect(result.headline).toBe('Best Travel Cards 2026');
    expect(result.url).toBe('https://cardcompare.in/guides/best-travel-cards');
    const author = result.author as any;
    expect(author.name).toBe('Pratik Potadar');
    expect(result.datePublished).toBe('2026-07-01');
    expect(result.dateModified).toBe('2026-07-25');
  });

  it('omits optional fields when not provided', () => {
    const result = articleSchema({
      title: 'Test',
      description: 'Test desc',
      path: '/test',
    });
    expect(result.author).toBeUndefined();
    expect(result.datePublished).toBeUndefined();
    expect(result.dateModified).toBeUndefined();
    expect(result.image).toBeUndefined();
  });

  it('includes publisher as Organization', () => {
    const result = articleSchema({
      title: 'Test',
      description: 'Test desc',
      path: '/test',
    });
    const publisher = result.publisher as any;
    expect(publisher['@type']).toBe('Organization');
    expect(publisher.name).toBe('CardCompare.in');
  });
});

/* ================================================================== */
/* organizationSchema                                                  */
/* ================================================================== */
describe('organizationSchema', () => {
  it('generates Organization JSON-LD', () => {
    const result = organizationSchema();
    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('Organization');
    expect(result.name).toBe('CardCompare.in');
    expect(result.url).toBe('https://cardcompare.in');
    expect(result.logo).toBe('https://cardcompare.in/favicon.svg');
  });
});

/* ================================================================== */
/* webSiteSchema                                                       */
/* ================================================================== */
describe('webSiteSchema', () => {
  it('generates WebSite JSON-LD with SearchAction', () => {
    const result = webSiteSchema();
    expect(result['@context']).toBe('https://schema.org');
    expect(result['@type']).toBe('WebSite');
    expect(result.name).toBe('CardCompare.in');
    expect(result.inLanguage).toBe('en-IN');
    const action = result.potentialAction as any;
    expect(action['@type']).toBe('SearchAction');
    expect(action.target.urlTemplate).toContain('/search?q=');
    expect(action['query-input']).toBe('required name=search_term_string');
  });
});
