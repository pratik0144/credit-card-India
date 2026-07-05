/*
 * best-card-for-purchase (POST) — §9.3.
 * For each candidate card: best-matching reward rate for category_key (fall back
 * to general), compute ₹ value for amount_inr, add a milestone-proximity nudge
 * when a card_bonuses threshold is within a proximity window. Sort by ₹ value.
 * card_ids optional; if omitted AND request is authenticated, default to the
 * caller's user_wallet_cards.
 * I/O: BestCardInput -> BestCardResult[] (database.types.ts).
 */
import { getServiceClient, getUserClient, handleOptions, json } from '../_shared/client.ts';
import {
  categoryValuePer100, inrPerPoint,
  type CardLike, type PointValuation, type RewardCatRow,
} from '../_shared/scoring.ts';
import type { SpendCategoryKey } from '../_shared/taxonomy.ts';

interface BestCardInput {
  category_key: SpendCategoryKey;
  amount_inr: number;
  card_ids?: string[];
}

interface DbCard extends CardLike {
  name: string;
}

const MILESTONE_PROXIMITY = 0.2; // within 20% of the threshold (§9.3)

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let input: BestCardInput;
  try { input = await req.json(); } catch { return json({ error: 'invalid JSON body' }, 400); }
  if (!input.category_key || !input.amount_inr) return json({ error: 'category_key and amount_inr required' }, 400);

  const supa = getServiceClient();

  // Resolve the candidate card_ids.
  let cardIds = input.card_ids ?? [];
  if (cardIds.length === 0) {
    // default to caller's wallet if authenticated (RLS-scoped via user client).
    try {
      const userSupa = getUserClient(req);
      const { data: wallet } = await userSupa.from('user_wallet_cards').select('card_id');
      cardIds = (wallet ?? []).map((w: any) => w.card_id);
    } catch { /* unauthenticated — leave empty */ }
  }
  if (cardIds.length === 0) return json({ error: 'no cards to compare (pass card_ids or sign in with a wallet)' }, 400);

  const [{ data: cardsRaw }, { data: rewardCats }, { data: valuations }, { data: bonuses }] =
    await Promise.all([
      supa.from('cards').select(
        'id,bank_id,name,reward_type,base_reward_value_inr_per_100,annual_fee_amount,annual_fee_waiver_spend_amount',
      ).in('id', cardIds).eq('is_active', true),
      supa.from('card_reward_categories').select('card_id,category_key,multiplier,rate_pct').in('card_id', cardIds),
      supa.from('point_valuations').select('bank_id,reward_type,estimated_inr_per_point_typical'),
      supa.from('card_bonuses').select('card_id,bonus_type,description,threshold_spend_amount').in('card_id', cardIds),
    ]);

  const cards = (cardsRaw ?? []) as DbCard[];
  const rewards = (rewardCats ?? []) as RewardCatRow[];
  const pvals = (valuations ?? []) as PointValuation[];
  const bonusList = (bonuses ?? []) as any[];

  const results = cards.map((c) => {
    const perPoint = inrPerPoint(c, pvals);
    const per100 = categoryValuePer100(c, input.category_key, rewards, perPoint);
    const estimated_value_inr = Math.round((input.amount_inr * per100) / 100);

    // milestone nudge: any bonus threshold the user is within 20% of, after this spend.
    let milestone_nudge: string | null = null;
    const cardBonuses = bonusList.filter((b) => b.card_id === c.id && b.threshold_spend_amount);
    for (const b of cardBonuses) {
      const threshold = b.threshold_spend_amount as number;
      const gap = threshold - input.amount_inr;
      if (gap > 0 && gap <= threshold * MILESTONE_PROXIMITY) {
        milestone_nudge = `₹${fmt(gap)} more spend unlocks this card's ${b.bonus_type} bonus`;
        break;
      }
    }

    return {
      card_id: c.id,
      card_name: c.name,
      estimated_value_inr,
      redemption_note:
        c.reward_type === 'cashback'
          ? 'Cashback — value is realized directly on your statement.'
          : 'Value varies by redemption channel — this assumes typical statement-credit/voucher redemption.',
      milestone_nudge,
    };
  });

  results.sort((a, b) => b.estimated_value_inr - a.estimated_value_inr);
  return json(results);
});

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN').format(Math.round(n));
}
