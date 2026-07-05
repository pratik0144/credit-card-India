/*
 * scripts/import-cards.ts — §7.1 structured import pass.
 *
 * Rerunnable and idempotent. Two modes:
 *   --dry-run (also the default when SUPABASE_SERVICE_ROLE_KEY is absent):
 *       parse all 368 source records using the pure helpers in scripts/lib/parse.ts,
 *       print a sample of fully-parsed cards, aggregate counts, and the §7.3
 *       post-import validation report. No DB writes — this is how we verify
 *       parsing correctness by hand without a live database (BACKEND §15.2).
 *   live (SUPABASE_SERVICE_ROLE_KEY present, no --dry-run):
 *       upsert banks + cards + card_snapshots + card_eligibility + card_fees +
 *       card_categories junction, upload card art to the card-images bucket,
 *       then trigger exactly ONE deploy-hook rebuild at the end of the run.
 *
 * The free-text reward-category / bonus / offer fields are intentionally NOT
 * parsed here — they are extracted in the separate deterministic enrichment pass
 * (scripts/enrich-cards.ts), which parses them from the source JSON (no API).
 *
 * Run:  npx tsx scripts/import-cards.ts --dry-run
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseMoney, parsePercent, parseAgeRange, parseEditorialScore, parseCibil,
  parseNetwork, parseRewardType, parseContactlessUpi, parseFuelSurchargePct,
  parseLounge, parseEligibility, deriveCardSlug, slugify, mapContentCategories,
  deriveConfidence, estimateBaseRewardPer100, hasEstMarker, stripEst,
  type EligibilityRow,
} from './lib/parse';
import type { ContentCategorySlug, CardNetwork, RewardType, DataConfidence } from '../src/lib/taxonomy';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env into process.env for standalone runs — tsx/Node don't auto-load it
// the way Astro/Vite does for the app. Without this, SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY are undefined and the script silently stays in
// dry-run. (Node 20.12+/22+ ships process.loadEnvFile.)
try { process.loadEnvFile(resolve(__dirname, '../.env')); } catch { /* no .env — use real env */ }
// Allow a project that only set the PUBLIC_ URL to still run the import.
process.env.SUPABASE_URL ||= process.env.PUBLIC_SUPABASE_URL;

const DATA_PATH = resolve(__dirname, '../bank-data/cc-data/Master-data-banks.json');

/* ------------------------------------------------------------------ */
/* Source record shape (BACKEND §1)                                    */
/* ------------------------------------------------------------------ */
interface SourceRecord {
  bank_name: string;
  card_name: string;
  card_img: string;
  card_type: string;
  card_network: string;
  'variant/tier': string;
  card_category: string;
  official_url: string;
  last_verified_at: string;
  joining_fee: string;
  annual_fee: string;
  annual_fee_waiver_spend: string;
  forex_markup: string;
  'Reward_type (points/cashback/miles)': string;
  reward_rate_general: string;
  reward_rate_category_wise: string;
  all_bonus: string;
  fuel_surcharge_waiver: string;
  airport_lounge_domestic: string;
  airport_lounge_international: string;
  'all_offers [highlights]': string;
  'contactless/UPI/support': string;
  minimum_income: string;
  employment_type: string;
  'age_min & age_max': string;
  cibil_min: string;
  card_score: string;
  [k: string]: unknown;
}

/* Fully-parsed card ready for upsert into `cards` (+ satellite rows). */
interface ParsedCard {
  bank_name: string;
  bank_slug: string;
  slug: string;
  name: string;
  image_url: string;
  card_type: 'credit' | 'debit';
  network: CardNetwork | null;
  network_is_estimated: boolean;
  tier: string | null;
  official_url: string | null;
  last_verified_at: string | null;
  joining_fee_amount: number | null;
  joining_fee_raw: string;
  annual_fee_amount: number | null;
  annual_fee_raw: string;
  annual_fee_waiver_spend_amount: number | null;
  annual_fee_waiver_spend_raw: string;
  forex_markup_pct: number | null;
  reward_type: RewardType | null;
  reward_rate_general_text: string | null;
  base_reward_value_inr_per_100: number | null;
  fuel_surcharge_waiver_text: string | null;
  fuel_surcharge_waiver_pct: number | null;
  lounge_domestic_visits_per_year: number | null;
  lounge_domestic_text: string | null;
  lounge_intl_visits_per_year: number | null;
  lounge_intl_network: string | null;
  lounge_intl_text: string | null;
  supports_contactless: boolean | null;
  supports_upi: boolean | null;
  age_min: number | null;
  age_max: number | null;
  cibil_min: number | null;
  cibil_min_is_estimated: boolean;
  editorial_score_raw: string | null;
  editorial_score_5: number | null;
  data_confidence: DataConfidence;
  estimated_fields: string[];
  content_categories: ContentCategorySlug[];
  is_discontinued: boolean;
  eligibility: EligibilityRow[];
  raw_source: SourceRecord;
}

function cardType(raw: string): 'credit' | 'debit' {
  return /debit/i.test(stripEst(raw)) ? 'debit' : 'credit';
}

/** Transform one source record into a fully-parsed card. Pure. */
export function parseRecord(r: SourceRecord): ParsedCard {
  const bank_slug = slugify(r.bank_name);
  const { data_confidence, estimated_fields } = deriveConfidence(r);
  const annual_fee_amount = parseMoney(r.annual_fee);
  const { slugs, isDiscontinued } = mapContentCategories(r.card_category, {
    tier: r['variant/tier'],
    rewardType: r['Reward_type (points/cashback/miles)'],
    annualFee: annual_fee_amount,
  });
  const net = parseNetwork(r.card_network);
  const age = parseAgeRange(r['age_min & age_max']);
  const cibil = parseCibil(r.cibil_min);
  const score = parseEditorialScore(r.card_score);
  const dom = parseLounge(r.airport_lounge_domestic);
  const intl = parseLounge(r.airport_lounge_international);
  const cu = parseContactlessUpi(r['contactless/UPI/support']);

  return {
    bank_name: r.bank_name,
    bank_slug,
    slug: deriveCardSlug(r.bank_name, r.card_name),
    name: r.card_name,
    image_url: r.card_img,
    card_type: cardType(r.card_type),
    network: net.network,
    network_is_estimated: net.network_is_estimated,
    tier: stripEst(r['variant/tier']) || null,
    official_url: r.official_url || null,
    last_verified_at: r.last_verified_at || null,
    joining_fee_amount: parseMoney(r.joining_fee),
    joining_fee_raw: r.joining_fee ?? '',
    annual_fee_amount,
    annual_fee_raw: r.annual_fee ?? '',
    annual_fee_waiver_spend_amount: parseMoney(r.annual_fee_waiver_spend),
    annual_fee_waiver_spend_raw: r.annual_fee_waiver_spend ?? '',
    forex_markup_pct: parsePercent(r.forex_markup),
    reward_type: parseRewardType(r['Reward_type (points/cashback/miles)']),
    reward_rate_general_text: stripEst(r.reward_rate_general) || null,
    base_reward_value_inr_per_100: estimateBaseRewardPer100(r.reward_rate_general),
    fuel_surcharge_waiver_text: stripEst(r.fuel_surcharge_waiver) || null,
    fuel_surcharge_waiver_pct: parseFuelSurchargePct(r.fuel_surcharge_waiver),
    lounge_domestic_visits_per_year: dom.visits_per_year,
    lounge_domestic_text: stripEst(r.airport_lounge_domestic) || null,
    lounge_intl_visits_per_year: intl.visits_per_year,
    lounge_intl_network: intl.network,
    lounge_intl_text: stripEst(r.airport_lounge_international) || null,
    supports_contactless: cu.supports_contactless,
    supports_upi: cu.supports_upi,
    age_min: age.age_min,
    age_max: age.age_max,
    cibil_min: cibil.cibil_min,
    cibil_min_is_estimated: cibil.cibil_min_is_estimated,
    editorial_score_raw: score.editorial_score_raw,
    editorial_score_5: score.editorial_score_5,
    data_confidence,
    estimated_fields,
    content_categories: slugs,
    is_discontinued: isDiscontinued,
    eligibility: parseEligibility(r.employment_type, r.minimum_income),
    raw_source: r,
  };
}

/* ------------------------------------------------------------------ */
/* §7.3 validation report                                              */
/* ------------------------------------------------------------------ */
interface QualityFlags {
  no_annual_fee: string[];
  no_cibil: string[];
  no_eligibility_income: string[];
  no_content_category: string[];
  no_reward_type: string[];
}

function buildReport(cards: ParsedCard[]): QualityFlags {
  const flags: QualityFlags = {
    no_annual_fee: [], no_cibil: [], no_eligibility_income: [],
    no_content_category: [], no_reward_type: [],
  };
  for (const c of cards) {
    if (c.annual_fee_amount === null) flags.no_annual_fee.push(c.slug);
    if (c.cibil_min === null && !/secured|fd-?backed/i.test(c.tier ?? '')) flags.no_cibil.push(c.slug);
    if (c.eligibility.every((e) => e.min_income_amount === null)) flags.no_eligibility_income.push(c.slug);
    if (c.content_categories.length === 0) flags.no_content_category.push(c.slug);
    if (c.reward_type === null) flags.no_reward_type.push(c.slug);
  }
  return flags;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */
function loadSource(): SourceRecord[] {
  const json = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
  if (!Array.isArray(json)) throw new Error('Master data is not an array');
  return json as SourceRecord[];
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_URL);
  const dryRun = args.has('--dry-run') || !hasServiceKey;

  const source = loadSource();
  const cards = source.map(parseRecord);

  console.log(`\n=== CardCompare import — parsed ${cards.length} records ===`);
  const banks = new Set(cards.map((c) => c.bank_slug));
  console.log(`Banks: ${banks.size}  |  Discontinued flagged: ${cards.filter((c) => c.is_discontinued).length}`);

  // Aggregate parse-coverage counts.
  const pct = (n: number) => `${((n / cards.length) * 100).toFixed(0)}%`;
  const has = (f: (c: ParsedCard) => boolean) => cards.filter(f).length;
  console.log('\n--- Parse coverage ---');
  console.log(`annual_fee_amount   : ${has((c) => c.annual_fee_amount !== null)} (${pct(has((c) => c.annual_fee_amount !== null))})`);
  console.log(`joining_fee_amount  : ${has((c) => c.joining_fee_amount !== null)}`);
  console.log(`cibil_min           : ${has((c) => c.cibil_min !== null)}`);
  console.log(`network             : ${has((c) => c.network !== null)}`);
  console.log(`reward_type         : ${has((c) => c.reward_type !== null)}`);
  console.log(`forex_markup_pct    : ${has((c) => c.forex_markup_pct !== null)}`);
  console.log(`lounge_domestic     : ${has((c) => c.lounge_domestic_visits_per_year !== null)}`);
  console.log(`editorial_score_5   : ${has((c) => c.editorial_score_5 !== null)}`);
  console.log(`>=1 content category: ${has((c) => c.content_categories.length > 0)}`);
  console.log(`>=1 eligibility row : ${has((c) => c.eligibility.length > 0)}`);

  const conf = { verified: 0, partially_estimated: 0, estimated: 0 } as Record<DataConfidence, number>;
  for (const c of cards) conf[c.data_confidence]++;
  console.log(`\n--- data_confidence ---\nverified: ${conf.verified} | partially_estimated: ${conf.partially_estimated} | estimated: ${conf.estimated}`);

  // §7.3 report.
  const flags = buildReport(cards);
  console.log('\n--- §7.3 validation flags (counts) ---');
  console.log(`missing annual_fee_amount : ${flags.no_annual_fee.length}`);
  console.log(`missing cibil_min (non-secured): ${flags.no_cibil.length}`);
  console.log(`no parsed income floor    : ${flags.no_eligibility_income.length}`);
  console.log(`no content category       : ${flags.no_content_category.length}`);
  console.log(`no reward_type            : ${flags.no_reward_type.length}`);
  if (flags.no_annual_fee.length) console.log(`  e.g. no-fee: ${flags.no_annual_fee.slice(0, 5).join(', ')}`);
  if (flags.no_content_category.length) console.log(`  e.g. no-category: ${flags.no_content_category.slice(0, 5).join(', ')}`);

  // Sample of 8 fully-parsed cards for hand-verification.
  console.log('\n--- Sample parsed cards (8) ---');
  const step = Math.floor(cards.length / 8) || 1;
  for (let i = 0; i < cards.length && i < step * 8; i += step) {
    const c = cards[i];
    console.log(`\n[${c.slug}]  ${c.bank_name} — ${c.name}`);
    console.log(`  type=${c.card_type} network=${c.network}${c.network_is_estimated ? '(est)' : ''} tier=${c.tier?.slice(0, 40)}`);
    console.log(`  joining=${c.joining_fee_amount} annual=${c.annual_fee_amount} waiver=${c.annual_fee_waiver_spend_amount} forex=${c.forex_markup_pct}%`);
    console.log(`  reward_type=${c.reward_type} base/₹100≈${c.base_reward_value_inr_per_100} lounge dom/intl=${c.lounge_domestic_visits_per_year}/${c.lounge_intl_visits_per_year}(${c.lounge_intl_network})`);
    console.log(`  age=${c.age_min}-${c.age_max} cibil=${c.cibil_min}${c.cibil_min_is_estimated ? '(est)' : ''} score5=${c.editorial_score_5} confidence=${c.data_confidence}`);
    console.log(`  categories=[${c.content_categories.join(', ')}]${c.is_discontinued ? ' DISCONTINUED' : ''}`);
    console.log(`  eligibility=${c.eligibility.map((e) => `${e.employment_type}:${e.min_income_amount ?? '—'}/${e.min_income_period ?? ''}`).join('  ')}`);
  }

  if (dryRun) {
    console.log('\n=== DRY RUN — no database writes. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY and drop --dry-run to import. ===\n');
    return;
  }

  await liveImport(cards);
}

/* ------------------------------------------------------------------ */
/* Live import (executed only with a service-role key)                 */
/* ------------------------------------------------------------------ */
async function liveImport(cards: ParsedCard[]) {
  // Build the service client directly from process.env. We do NOT import the
  // app's src/lib/supabase.ts here — that reads import.meta.env (Vite), which is
  // undefined under tsx/Node and would throw.
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (server env).');
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  console.log(`\n=== LIVE IMPORT: ${cards.length} cards ===`);

  // 1. Upsert banks.
  const bankBySlug = new Map<string, string>();
  const uniqueBanks = [...new Map(cards.map((c) => [c.bank_slug, c.bank_name])).entries()];
  for (const [slug, name] of uniqueBanks) {
    const { data, error } = await supabase
      .from('banks')
      .upsert({ slug, name }, { onConflict: 'slug' })
      .select('id')
      .single();
    if (error) throw error;
    bankBySlug.set(slug, data.id);
  }
  console.log(`Upserted ${uniqueBanks.length} banks.`);

  // 2. Category id lookup.
  const { data: cats, error: catErr } = await supabase.from('categories').select('id, slug');
  if (catErr) throw catErr;
  const catBySlug = new Map((cats ?? []).map((c: { id: string; slug: string }) => [c.slug, c.id]));

  // 3. Upsert cards + satellites + snapshots.
  let imported = 0;
  for (const c of cards) {
    const bank_id = bankBySlug.get(c.bank_slug)!;
    const cardRow = {
      bank_id, slug: c.slug, name: c.name, image_url: c.image_url,
      card_type: c.card_type, network: c.network, network_is_estimated: c.network_is_estimated,
      tier: c.tier, official_url: c.official_url, last_verified_at: c.last_verified_at,
      joining_fee_amount: c.joining_fee_amount, joining_fee_raw: c.joining_fee_raw,
      annual_fee_amount: c.annual_fee_amount, annual_fee_raw: c.annual_fee_raw,
      annual_fee_waiver_spend_amount: c.annual_fee_waiver_spend_amount,
      annual_fee_waiver_spend_raw: c.annual_fee_waiver_spend_raw,
      forex_markup_pct: c.forex_markup_pct, reward_type: c.reward_type,
      reward_rate_general_text: c.reward_rate_general_text,
      base_reward_value_inr_per_100: c.base_reward_value_inr_per_100,
      fuel_surcharge_waiver_text: c.fuel_surcharge_waiver_text,
      fuel_surcharge_waiver_pct: c.fuel_surcharge_waiver_pct,
      lounge_domestic_visits_per_year: c.lounge_domestic_visits_per_year,
      lounge_domestic_text: c.lounge_domestic_text,
      lounge_intl_visits_per_year: c.lounge_intl_visits_per_year,
      lounge_intl_network: c.lounge_intl_network, lounge_intl_text: c.lounge_intl_text,
      supports_contactless: c.supports_contactless, supports_upi: c.supports_upi,
      age_min: c.age_min, age_max: c.age_max,
      cibil_min: c.cibil_min, cibil_min_is_estimated: c.cibil_min_is_estimated,
      editorial_score_raw: c.editorial_score_raw, editorial_score_5: c.editorial_score_5,
      data_confidence: c.data_confidence, estimated_fields: c.estimated_fields,
      raw_source: c.raw_source, is_active: !c.is_discontinued,
    };
    const { data: card, error } = await supabase
      .from('cards')
      .upsert(cardRow, { onConflict: 'slug' })
      .select('id')
      .single();
    if (error) { console.error(`Card upsert failed for ${c.slug}:`, error.message); continue; }
    const card_id = card.id;

    // Snapshot (§4.1 / §9.4) — one per run.
    await supabase.from('card_snapshots').insert({ card_id, snapshot: cardRow });

    // Content category junction (first = primary).
    await supabase.from('card_categories').delete().eq('card_id', card_id);
    for (let i = 0; i < c.content_categories.length; i++) {
      const category_id = catBySlug.get(c.content_categories[i]);
      if (category_id) {
        await supabase.from('card_categories').insert({ card_id, category_id, is_primary: i === 0 });
      }
    }

    // Eligibility.
    await supabase.from('card_eligibility').delete().eq('card_id', card_id);
    if (c.eligibility.length) {
      await supabase.from('card_eligibility').insert(c.eligibility.map((e) => ({ card_id, ...e })));
    }
    imported++;
  }
  console.log(`Imported/updated ${imported} cards.`);

  // 4. Single deploy-hook rebuild (§7.1.10) — batch, not per row.
  if (process.env.DEPLOY_HOOK_URL) {
    await fetch(process.env.DEPLOY_HOOK_URL, { method: 'POST' }).catch((e) => console.error('deploy hook failed', e));
    console.log('Triggered one deploy-hook rebuild.');
  }
  console.log('NOTE: card_reward_categories / card_bonuses / card_offers are populated by scripts/enrich-cards.ts (deterministic, run next).');
}

main().catch((e) => { console.error(e); process.exit(1); });
