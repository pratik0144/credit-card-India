import { describe, it, expect } from 'vitest';
import {
  rankCardsForPurchase,
  type BestCardCandidate,
  type PointValuationLite,
} from '../src/lib/best-card-engine';

/* ---- Shared test fixtures ---- */
const valuations: PointValuationLite[] = [
  { bank_id: 'bank-hdfc', reward_type: 'points', estimated_inr_per_point_typical: 0.35 },
  { bank_id: 'bank-icici', reward_type: 'cashback', estimated_inr_per_point_typical: 1.0 },
  { bank_id: null, reward_type: 'points', estimated_inr_per_point_typical: 0.25 },
  { bank_id: null, reward_type: 'miles', estimated_inr_per_point_typical: 0.75 },
];

function makeCard(overrides: Partial<BestCardCandidate> & { id: string; name: string }): BestCardCandidate {
  return {
    bank_name: 'Test Bank',
    bank_id: 'bank-test',
    reward_type: 'points',
    base_reward_value_inr_per_100: 1.0,
    annual_fee_amount: 0,
    annual_fee_waiver_spend_amount: null,
    rewardCategories: [],
    ...overrides,
  };
}

/* ================================================================== */
/* Basic ranking                                                       */
/* ================================================================== */
describe('rankCardsForPurchase', () => {
  it('ranks cards by estimated value (highest first)', () => {
    const cards: BestCardCandidate[] = [
      makeCard({
        id: 'low',
        name: 'Low Reward Card',
        base_reward_value_inr_per_100: 0.5,
      }),
      makeCard({
        id: 'high',
        name: 'High Reward Card',
        base_reward_value_inr_per_100: 5,
        reward_type: 'cashback',
      }),
      makeCard({
        id: 'mid',
        name: 'Mid Reward Card',
        base_reward_value_inr_per_100: 2,
        reward_type: 'cashback',
      }),
    ];

    const ranked = rankCardsForPurchase(cards, 'general', 10000, valuations);
    expect(ranked).toHaveLength(3);
    expect(ranked[0].card_id).toBe('high');
    expect(ranked[1].card_id).toBe('mid');
    expect(ranked[2].card_id).toBe('low');
  });

  it('assigns rank numbers starting at 1', () => {
    const cards: BestCardCandidate[] = [
      makeCard({ id: 'a', name: 'Card A', base_reward_value_inr_per_100: 2, reward_type: 'cashback' }),
      makeCard({ id: 'b', name: 'Card B', base_reward_value_inr_per_100: 1, reward_type: 'cashback' }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', 5000, valuations);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it('calculates correct estimated value', () => {
    const cards: BestCardCandidate[] = [
      makeCard({
        id: 'cash',
        name: 'Cashback Card',
        reward_type: 'cashback',
        base_reward_value_inr_per_100: 2, // 2% cashback
      }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', 10000, valuations);
    // 2% of ₹10,000 = ₹200
    expect(ranked[0].estimated_value_inr).toBe(200);
  });

  it('uses category-specific rates over base rate', () => {
    const cards: BestCardCandidate[] = [
      makeCard({
        id: 'dining-card',
        name: 'Dining Card',
        reward_type: 'cashback',
        base_reward_value_inr_per_100: 1,
        rewardCategories: [
          { category_key: 'dining', multiplier: null, rate_pct: 5 },
        ],
      }),
    ];
    const ranked = rankCardsForPurchase(cards, 'dining', 5000, valuations);
    // 5% of ₹5,000 = ₹250
    expect(ranked[0].estimated_value_inr).toBe(250);
    expect(ranked[0].effective_per100).toBe(5);
  });

  it('falls back to base rate when no category row matches', () => {
    const cards: BestCardCandidate[] = [
      makeCard({
        id: 'no-cat',
        name: 'No Category Match',
        reward_type: 'cashback',
        base_reward_value_inr_per_100: 1.5,
        rewardCategories: [
          { category_key: 'dining', multiplier: null, rate_pct: 5 },
        ],
      }),
    ];
    const ranked = rankCardsForPurchase(cards, 'groceries', 10000, valuations);
    // Falls back to base: 1.5% of ₹10,000 = ₹150
    expect(ranked[0].estimated_value_inr).toBe(150);
  });
});

/* ================================================================== */
/* Why explanations                                                    */
/* ================================================================== */
describe('rankCardsForPurchase — why explanations', () => {
  it('first card gets "Best value" explanation', () => {
    const cards: BestCardCandidate[] = [
      makeCard({ id: 'a', name: 'Card A', reward_type: 'cashback', base_reward_value_inr_per_100: 3 }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', 5000, valuations);
    expect(ranked[0].why[0]).toContain('Best value');
  });

  it('subsequent cards get relative ranking explanation', () => {
    const cards: BestCardCandidate[] = [
      makeCard({ id: 'a', name: 'Card A', reward_type: 'cashback', base_reward_value_inr_per_100: 5 }),
      makeCard({ id: 'b', name: 'Card B', reward_type: 'cashback', base_reward_value_inr_per_100: 1 }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', 10000, valuations);
    expect(ranked[1].why[0]).toContain('Ranks #2');
    expect(ranked[1].why[0]).toContain('less than the top card');
  });

  it('explains category-specific earn rate', () => {
    const cards: BestCardCandidate[] = [
      makeCard({
        id: 'dining',
        name: 'Dining Card',
        reward_type: 'cashback',
        base_reward_value_inr_per_100: 1,
        rewardCategories: [
          { category_key: 'dining', multiplier: null, rate_pct: 5 },
        ],
      }),
    ];
    const ranked = rankCardsForPurchase(cards, 'dining', 5000, valuations);
    const why = ranked[0].why.join(' ');
    expect(why).toContain('cashback');
    expect(why).toContain('Dining');
  });

  it('explains lifetime-free benefit', () => {
    const cards: BestCardCandidate[] = [
      makeCard({
        id: 'free',
        name: 'Free Card',
        reward_type: 'cashback',
        base_reward_value_inr_per_100: 1,
        annual_fee_amount: 0,
      }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', 5000, valuations);
    const why = ranked[0].why.join(' ');
    expect(why).toContain('Lifetime-free');
  });

  it('explains annual fee context', () => {
    const cards: BestCardCandidate[] = [
      makeCard({
        id: 'paid',
        name: 'Paid Card',
        reward_type: 'cashback',
        base_reward_value_inr_per_100: 3,
        annual_fee_amount: 2500,
        annual_fee_waiver_spend_amount: 300000,
      }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', 10000, valuations);
    const why = ranked[0].why.join(' ');
    expect(why).toContain('₹2,500');
    expect(why).toContain('waived');
  });
});

/* ================================================================== */
/* Redemption notes                                                    */
/* ================================================================== */
describe('rankCardsForPurchase — redemption notes', () => {
  it('cashback cards get statement-credit note', () => {
    const cards: BestCardCandidate[] = [
      makeCard({ id: 'cash', name: 'CB Card', reward_type: 'cashback', base_reward_value_inr_per_100: 2 }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', 5000, valuations);
    expect(ranked[0].redemption_note).toContain('statement');
  });

  it('points cards get redemption-dependent note', () => {
    const cards: BestCardCandidate[] = [
      makeCard({ id: 'pts', name: 'Points Card', reward_type: 'points', base_reward_value_inr_per_100: 2 }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', 5000, valuations);
    expect(ranked[0].redemption_note).toContain('depends on how you redeem');
  });
});

/* ================================================================== */
/* Edge cases                                                          */
/* ================================================================== */
describe('rankCardsForPurchase — edge cases', () => {
  it('handles empty candidate list', () => {
    const ranked = rankCardsForPurchase([], 'general', 5000, valuations);
    expect(ranked).toEqual([]);
  });

  it('handles zero amount', () => {
    const cards: BestCardCandidate[] = [
      makeCard({ id: 'a', name: 'Card A', reward_type: 'cashback', base_reward_value_inr_per_100: 5 }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', 0, valuations);
    expect(ranked[0].estimated_value_inr).toBe(0);
  });

  it('handles negative amount as 0', () => {
    const cards: BestCardCandidate[] = [
      makeCard({ id: 'a', name: 'Card A', reward_type: 'cashback', base_reward_value_inr_per_100: 5 }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', -500, valuations);
    expect(ranked[0].estimated_value_inr).toBe(0);
  });

  it('handles card with null base reward', () => {
    const cards: BestCardCandidate[] = [
      makeCard({ id: 'null-base', name: 'Null Base', base_reward_value_inr_per_100: null }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', 5000, valuations);
    expect(ranked[0].estimated_value_inr).toBe(0);
  });

  it('uses multiplier with base rate for points cards', () => {
    const cards: BestCardCandidate[] = [
      makeCard({
        id: 'multi',
        name: 'Multiplier Card',
        reward_type: 'points',
        base_reward_value_inr_per_100: 1,
        rewardCategories: [
          { category_key: 'groceries', multiplier: 5, rate_pct: null },
        ],
      }),
    ];
    const ranked = rankCardsForPurchase(cards, 'groceries', 10000, valuations);
    // multiplier 5 × base 1 = 5 per 100; 5% of ₹10,000 = ₹500
    expect(ranked[0].estimated_value_inr).toBe(500);
    expect(ranked[0].effective_per100).toBe(5);
  });

  it('sorts alphabetically when values tie', () => {
    const cards: BestCardCandidate[] = [
      makeCard({ id: 'b', name: 'Zebra Card', reward_type: 'cashback', base_reward_value_inr_per_100: 2 }),
      makeCard({ id: 'a', name: 'Alpha Card', reward_type: 'cashback', base_reward_value_inr_per_100: 2 }),
    ];
    const ranked = rankCardsForPurchase(cards, 'general', 5000, valuations);
    expect(ranked[0].card_name).toBe('Alpha Card');
    expect(ranked[1].card_name).toBe('Zebra Card');
  });
});
