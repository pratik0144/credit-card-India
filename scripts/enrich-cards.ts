/*
 * scripts/enrich-cards.ts — DETERMINISTIC enrichment pass (replaces the old
 * LLM/Anthropic version). Parses each card's free-text reward/bonus/offer prose
 * from the source JSON into structured rows using the pure parsers in
 * scripts/lib/parse.ts — NO external API, no ANTHROPIC_API_KEY, fully offline.
 *
 * Populates: card_reward_categories, card_bonuses, card_offers, and recomputes
 * cards.base_reward_value_inr_per_100 from the general rate + point_valuations.
 *
 * Idempotent: clears a card's existing parsed rows before re-inserting, so it's
 * safe to re-run. Run AFTER import-cards.ts.
 *
 * Run:  npx tsx scripts/enrich-cards.ts            (live, needs SUPABASE_* env)
 *       npx tsx scripts/enrich-cards.ts --dry-run  (parse + print a sample, no writes)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseRewardCategories, parseBonuses, parseOffers, deriveCardSlug,
} from './lib/parse';

const __dirname = dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(resolve(__dirname, '../.env')); } catch { /* use real env */ }
process.env.SUPABASE_URL ||= process.env.PUBLIC_SUPABASE_URL;

const DATA_PATH = resolve(__dirname, '../bank-data/cc-data/Master-data-banks.json');

interface SourceRecord {
  bank_name: string; card_name: string;
  'Reward_type (points/cashback/miles)': string;
  reward_rate_general: string;
  reward_rate_category_wise: string;
  all_bonus: string;
  'all_offers [highlights]': string;
  [k: string]: unknown;
}

function loadSource(): SourceRecord[] {
  return JSON.parse(readFileSync(DATA_PATH, 'utf8')) as SourceRecord[];
}

function rewardType(r: SourceRecord): 'points' | 'cashback' | 'miles' | 'hybrid' | null {
  const s = String(r['Reward_type (points/cashback/miles)'] ?? '').toLowerCase();
  const cb = /cashback|cash\s*back/.test(s), mi = /mile/.test(s), pt = /point|reward/.test(s);
  const n = [cb, mi, pt].filter(Boolean).length;
  if (n >= 2) return 'hybrid';
  if (mi) return 'miles';
  if (cb) return 'cashback';
  if (pt) return 'points';
  return null;
}

/** ₹/₹100 at the general rate using a point valuation. */
function basePer100(rewardCats: ReturnType<typeof parseRewardCategories>, rt: string | null, perPoint: number): number | null {
  const general = rewardCats.find((c) => c.category_key === 'general');
  if (!general) return null;
  if (rt === 'cashback') return general.rate_pct ?? null;
  if (general.rate_pct != null) return general.rate_pct;
  if (general.multiplier != null) return Math.round(general.multiplier * perPoint * 100) / 100;
  return null;
}

async function main() {
  const dryRun = new Set(process.argv.slice(2)).has('--dry-run')
    || !(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const source = loadSource();
  console.log(`\n=== enrich-cards (deterministic) — ${source.length} records ===`);

  // Parse everything up front (pure).
  const parsed = source.map((r) => {
    const rt = rewardType(r);
    const rewardCats = parseRewardCategories(r.reward_rate_category_wise, r.reward_rate_general, rt);
    return {
      slug: deriveCardSlug(r.bank_name, r.card_name),
      bank_name: r.bank_name, rt,
      rewardCats,
      bonuses: parseBonuses(r.all_bonus),
      offers: parseOffers(r['all_offers [highlights]']),
    };
  });

  const totalCats = parsed.reduce((a, p) => a + p.rewardCats.length, 0);
  const totalBonus = parsed.reduce((a, p) => a + p.bonuses.length, 0);
  const totalOffers = parsed.reduce((a, p) => a + p.offers.length, 0);
  const noCats = parsed.filter((p) => p.rewardCats.length === 0).length;
  console.log(`Parsed: ${totalCats} reward-category rows, ${totalBonus} bonuses, ${totalOffers} offers.`);
  console.log(`Cards with 0 reward categories: ${noCats}`);

  if (dryRun) {
    console.log('\n--- Sample (5 cards) ---');
    for (const p of [parsed[0], parsed[40], parsed[120], parsed[200], parsed[300]].filter(Boolean)) {
      console.log(`\n[${p.slug}] type=${p.rt}`);
      console.log('  reward_categories:', p.rewardCats.map((c) => `${c.category_key}=${c.multiplier ? c.multiplier + 'X' : (c.rate_pct ?? '?') + '%'}${c.cap_amount ? `(cap ₹${c.cap_amount}/${c.cap_period})` : ''}`).join('  ') || '(none)');
      console.log('  bonuses:', p.bonuses.map((b) => `${b.bonus_type}${b.threshold_spend_amount ? `@₹${b.threshold_spend_amount}` : ''}`).join('  ') || '(none)');
      console.log('  offers:', p.offers.length);
    }
    console.log('\n=== DRY RUN — no writes. Drop --dry-run with SUPABASE_* set to enrich. ===\n');
    return;
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  // Look up card ids + point valuations once.
  const { data: cards } = await supa.from('cards').select('id, slug, bank_id, reward_type');
  const idBySlug = new Map((cards ?? []).map((c: any) => [c.slug, c]));
  const { data: valuations } = await supa.from('point_valuations').select('bank_id, reward_type, estimated_inr_per_point_typical');
  const perPointFor = (bankId: string, rt: string | null): number => {
    if (rt === 'cashback') return 1;
    const v = (valuations ?? []).find((x: any) => x.bank_id === bankId) as any;
    return v?.estimated_inr_per_point_typical ?? (rt === 'miles' ? 0.75 : 0.25);
  };

  let enriched = 0;
  for (const p of parsed) {
    const card = idBySlug.get(p.slug) as any;
    if (!card) continue;
    const cardId = card.id;

    // Idempotent: clear this card's existing parsed rows first.
    await supa.from('card_reward_categories').delete().eq('card_id', cardId);
    await supa.from('card_bonuses').delete().eq('card_id', cardId);
    await supa.from('card_offers').delete().eq('card_id', cardId);

    if (p.rewardCats.length) {
      await supa.from('card_reward_categories').insert(p.rewardCats.map((c) => ({
        card_id: cardId, category_key: c.category_key, multiplier: c.multiplier,
        rate_pct: c.rate_pct, cap_amount: c.cap_amount, cap_period: c.cap_period,
        raw_text: c.raw_text, parsed_by_llm: false, needs_review: true,
      })));
    }
    if (p.bonuses.length) {
      await supa.from('card_bonuses').insert(p.bonuses.map((b) => ({
        card_id: cardId, bonus_type: b.bonus_type, description: b.description,
        threshold_spend_amount: b.threshold_spend_amount, estimated_value_inr: b.estimated_value_inr,
        is_estimated: b.is_estimated, parsed_by_llm: false, needs_review: true,
      })));
    }
    if (p.offers.length) {
      await supa.from('card_offers').insert(p.offers.map((o) => ({
        card_id: cardId, offer_text: o.offer_text, category: o.category,
        is_estimated: o.is_estimated, parsed_by_llm: false, needs_review: true,
      })));
    }

    const per100 = basePer100(p.rewardCats, card.reward_type ?? p.rt, perPointFor(card.bank_id, card.reward_type ?? p.rt));
    if (per100 != null) await supa.from('cards').update({ base_reward_value_inr_per_100: per100 }).eq('id', cardId);

    enriched++;
    if (enriched % 50 === 0) console.log(`  …${enriched} enriched`);
  }
  console.log(`\nDone. Enriched ${enriched} cards (reward categories, bonuses, offers).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
