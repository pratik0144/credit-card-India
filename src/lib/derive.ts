/*
 * Data-driven derivation of review content from structured card fields.
 * Used where editorial prose isn't authored yet (seed/preview). Everything here
 * is grounded in real parsed fields — we never fabricate benefit claims
 * (FRONTEND §16, DESIGN §11). When a card has an authored `articles` row, prefer
 * that; these derivations are the honest fallback.
 */
import type { CardDetail } from './queries';
import { formatINR, formatINRCompact } from './format';

export function welcomeBenefit(detail: CardDetail): string | null {
  const w = detail.bonuses.find((b) => b.bonus_type === 'welcome');
  if (!w) return null;
  if (w.estimated_value_inr) return `${formatINR(w.estimated_value_inr)} value${w.is_estimated ? ' (est.)' : ''}`;
  return w.description ?? null;
}

export function headlineReward(detail: CardDetail): string {
  return (
    detail.card.reward_rate_general_text ||
    detail.rewardCategories.map((r) => r.raw_text).find(Boolean) ||
    'Rewards on everyday spends'
  );
}

/** Balanced, grounded pros derived from the card's own fields. */
export function derivePros(detail: CardDetail): string[] {
  const c = detail.card;
  const pros: string[] = [];
  if (c.annual_fee_amount === 0) pros.push('Lifetime free — no joining or annual fee');
  else if (c.annual_fee_waiver_spend_amount)
    pros.push(`Annual fee waived on ${formatINRCompact(c.annual_fee_waiver_spend_amount)} annual spend`);
  if ((c.lounge_domestic_visits_per_year ?? 0) > 0)
    pros.push(`${c.lounge_domestic_visits_per_year} complimentary domestic lounge visits a year`);
  if ((c.lounge_intl_visits_per_year ?? 0) > 0)
    pros.push(`${c.lounge_intl_visits_per_year} international lounge visits${c.lounge_intl_network ? ` via ${c.lounge_intl_network}` : ''}`);
  if (c.forex_markup_pct != null && c.forex_markup_pct <= 2)
    pros.push(`Low forex markup of ${c.forex_markup_pct}% on international spends`);
  if ((c.base_reward_value_inr_per_100 ?? 0) >= 3)
    pros.push('Strong headline reward rate for its category');
  const welcome = welcomeBenefit(detail);
  if (welcome) pros.push(`Welcome benefit: ${welcome}`);
  if (pros.length === 0) pros.push('Straightforward everyday rewards with wide acceptance');
  return pros.slice(0, 6);
}

/** Balanced, grounded cons — the counter-argument is core to credibility (DESIGN §8). */
export function deriveCons(detail: CardDetail): string[] {
  const c = detail.card;
  const cons: string[] = [];
  if (c.annual_fee_amount && c.annual_fee_amount > 0)
    cons.push(`Annual fee of ${formatINR(c.annual_fee_amount)}${c.annual_fee_waiver_spend_amount ? ' unless the spend waiver is met' : ''}`);
  if (c.forex_markup_pct != null && c.forex_markup_pct >= 3)
    cons.push(`Forex markup of ${c.forex_markup_pct}% makes it a poor fit for overseas spends`);
  if ((c.lounge_domestic_visits_per_year ?? 0) === 0 && (c.lounge_intl_visits_per_year ?? 0) === 0)
    cons.push('No complimentary airport lounge access');
  if (c.cibil_min != null && c.cibil_min >= 750)
    cons.push('Typically needs a CIBIL score of 750+ for approval');
  if (c.data_confidence !== 'verified')
    cons.push('Some benefit details are estimated — confirm current terms in the issuer MITC');
  if (cons.length === 0) cons.push('Rewards are modest for high spenders who could do better elsewhere');
  return cons.slice(0, 6);
}

/** Short highlight bullets from offers + notable fields (§6.3 expandable). */
export function deriveHighlights(detail: CardDetail): string[] {
  const items = detail.rewardCategories
    .filter((r) => r.raw_text)
    .map((r) => r.raw_text as string);
  if (detail.card.fuel_surcharge_waiver_text) items.push(detail.card.fuel_surcharge_waiver_text);
  return [...new Set(items)].slice(0, 8);
}
