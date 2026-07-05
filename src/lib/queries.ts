/*
 * Data-access layer owned by the frontend build. Each catalog read prefers the
 * live Supabase tables/views (BACKEND_PROMPT.md §4/§4.6, e.g. card_listing_view)
 * but ALWAYS falls back to the hand-derived seed data in seed-data.ts when:
 *   - Supabase env is not configured, OR
 *   - the live query errors (e.g. tables not migrated yet), OR
 *   - the live query returns zero rows (e.g. catalog not imported yet).
 * This means the site is never blank while Supabase is still being set up — you
 * only see live data once the catalog is actually populated. A one-time console
 * warning explains which case you're in. (User-scoped reads — wallet — do NOT
 * fall back to seed; they legitimately return empty for a new user.)
 */
import { getAnonClient, hasSupabaseEnv } from './supabase';
import type {
  Bank, Category, Card, CardRewardCategory, CardBonus, CardFee, CardEligibility,
  CardRating, CardChangeLog, Author, Article, CardListingRow,
} from './database.types';
import { seed, type SeedCard } from './seed-data';

/* ---- resilient live-or-seed helpers ---- */
const _warned = new Set<string>();
function warnOnce(label: string, detail: string) {
  if (_warned.has(label)) return;
  _warned.add(label);
  console.warn(`[queries] ${label}: falling back to seed data — ${detail}`);
}

/**
 * Run a live Supabase array query; fall back to `seedValue` on no-env, error, or
 * empty result. `emptyIsFallback` (default true) treats a 0-row result as "not
 * imported yet" and returns seed; set false where an empty live result is valid.
 */
async function liveArray<T>(
  label: string,
  run: () => Promise<{ data: T[] | null; error: { message: string } | null }>,
  seedValue: T[],
  emptyIsFallback = true,
): Promise<T[]> {
  if (!hasSupabaseEnv) return seedValue;
  try {
    const { data, error } = await run();
    if (error) { warnOnce(label, `live query error: ${error.message}. Run the migrations.`); return seedValue; }
    if (emptyIsFallback && (!data || data.length === 0)) {
      warnOnce(label, 'live query returned 0 rows. Import the catalog (npm run import:cards).');
      return seedValue;
    }
    return data ?? seedValue;
  } catch (e) {
    warnOnce(label, `live query threw: ${(e as Error).message}. Check PUBLIC_SUPABASE_URL/KEY.`);
    return seedValue;
  }
}

/** Full assembled review payload for a card detail page. */
export interface CardDetail {
  card: Card;
  bank: Bank;
  rating: CardRating | null;
  rewardCategories: CardRewardCategory[];
  bonuses: CardBonus[];
  fees: CardFee[];
  eligibility: CardEligibility[];
  changeLog: CardChangeLog[];
  article: Article | null;
  categorySlugs: string[];
}

/* ------------------------------------------------------------- Banks ------ */
export async function getBanks(): Promise<Bank[]> {
  return liveArray('banks', () => getAnonClient().from('banks').select('*').order('name'), seed.banks);
}

export async function getBankBySlug(slug: string): Promise<Bank | null> {
  const banks = await getBanks();
  return banks.find((b) => b.slug === slug) ?? seed.bankBySlug[slug] ?? null;
}

/* -------------------------------------------------------- Categories ------ */
export async function getCategories(): Promise<Category[]> {
  return liveArray('categories', () => getAnonClient().from('categories').select('*').order('display_order'), seed.categories);
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

/* ------------------------------------------- Card listing (view-backed) --- */
/** Powers /best/[category] and the homepage featured rows. `category` filters
 *  by content-category slug; omit for all cards. Sorted by editorial order. */
export async function getCardListing(category?: string): Promise<CardListingRow[]> {
  const seedRows = seed.cards
    .filter((c) => c.is_active)
    .filter((c) => !category || c.category_slugs.includes(category))
    .map((c) => seed.listingRowFor(c))
    // Default editorial order: overall score desc, then name.
    .sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0) || a.card_name.localeCompare(b.card_name));
  return liveArray<CardListingRow>(
    `card_listing_view${category ? `:${category}` : ''}`,
    () => {
      let q = getAnonClient().from('card_listing_view').select('*');
      if (category) q = q.eq('primary_category_slug', category);
      return q;
    },
    seedRows,
  );
}

/* --------------------------------------------------- Card detail page ----- */
export async function getCardBySlug(bankSlug: string, cardSlug: string): Promise<CardDetail | null> {
  const fullSlug = `${bankSlug}-${cardSlug}`;
  const seedFallback = () => {
    const card = seed.cardBySlug[fullSlug];
    return card ? buildSeedDetail(card) : null;
  };
  if (hasSupabaseEnv) {
    try {
      const supabase = getAnonClient();
      const { data: card, error } = await supabase.from('cards').select('*').eq('slug', fullSlug).maybeSingle();
      if (error) { warnOnce('cards:detail', `live query error: ${error.message}`); return seedFallback(); }
      if (!card) return seedFallback();
      return await assembleLiveDetail(card as Card);
    } catch (e) {
      warnOnce('cards:detail', `live query threw: ${(e as Error).message}`);
      return seedFallback();
    }
  }
  return seedFallback();
}

/** Assemble a full CardDetail from a live `cards` row (shared by slug/id lookups). */
async function assembleLiveDetail(card: Card): Promise<CardDetail> {
  const supabase = getAnonClient();
  const cardId = card.id;
  const [bank, rating, rewardCategories, bonuses, fees, eligibility, changeLog, article, cats] =
    await Promise.all([
      supabase.from('banks').select('*').eq('id', card.bank_id).maybeSingle(),
      supabase.from('card_ratings').select('*').eq('card_id', cardId).maybeSingle(),
      supabase.from('card_reward_categories').select('*').eq('card_id', cardId),
      supabase.from('card_bonuses').select('*').eq('card_id', cardId),
      supabase.from('card_fees').select('*').eq('card_id', cardId),
      supabase.from('card_eligibility').select('*').eq('card_id', cardId),
      supabase.from('card_change_log').select('*').eq('card_id', cardId).order('detected_at', { ascending: false }),
      supabase.from('articles').select('*').eq('related_card_id', cardId).eq('is_published', true).maybeSingle(),
      supabase.from('card_categories').select('category_id, categories(slug)').eq('card_id', cardId),
    ]);
  return {
    card,
    bank: bank.data as Bank,
    rating: (rating.data as CardRating) ?? null,
    rewardCategories: (rewardCategories.data ?? []) as CardRewardCategory[],
    bonuses: (bonuses.data ?? []) as CardBonus[],
    fees: (fees.data ?? []) as CardFee[],
    eligibility: (eligibility.data ?? []) as CardEligibility[],
    changeLog: (changeLog.data ?? []) as CardChangeLog[],
    article: (article.data as Article) ?? null,
    categorySlugs: ((cats.data ?? []) as { categories: { slug: string } }[]).map((r) => r.categories?.slug).filter(Boolean),
  };
}

function buildSeedDetail(card: SeedCard): CardDetail {
  return {
    card,
    bank: seed.bankById[card.bank_id],
    rating: seed.cardRatings.find((r) => r.card_id === card.id) ?? null,
    rewardCategories: seed.cardRewardCategories.filter((r) => r.card_id === card.id),
    bonuses: seed.cardBonuses.filter((b) => b.card_id === card.id),
    fees: seed.cardFees.filter((f) => f.card_id === card.id),
    eligibility: seed.cardEligibility.filter((e) => e.card_id === card.id),
    changeLog: seed.cardChangeLog.filter((c) => c.card_id === card.id),
    article: seed.articles.find((a) => a.related_card_id === card.id) ?? null,
    categorySlugs: card.category_slugs,
  };
}

/**
 * Batched detail lookup for listing pages: assembles a CardDetail for many cards
 * in a FIXED number of queries (one per satellite table with an `in` filter),
 * not N×9. Use this on /best/[category], /banks/[bank], and the homepage instead
 * of calling getCardDetailById per row (which would balloon build time).
 */
export async function getCardDetailsByIds(cardIds: string[]): Promise<Map<string, CardDetail>> {
  const out = new Map<string, CardDetail>();
  if (cardIds.length === 0) return out;

  if (hasSupabaseEnv) {
    try {
      const supabase = getAnonClient();
      const [cards, banks, ratings, rewards, bonuses, fees, elig, changes, articles, cats] = await Promise.all([
        supabase.from('cards').select('*').in('id', cardIds),
        supabase.from('banks').select('*'),
        supabase.from('card_ratings').select('*').in('card_id', cardIds),
        supabase.from('card_reward_categories').select('*').in('card_id', cardIds),
        supabase.from('card_bonuses').select('*').in('card_id', cardIds),
        supabase.from('card_fees').select('*').in('card_id', cardIds),
        supabase.from('card_eligibility').select('*').in('card_id', cardIds),
        supabase.from('card_change_log').select('*').in('card_id', cardIds).order('detected_at', { ascending: false }),
        supabase.from('articles').select('*').in('related_card_id', cardIds).eq('is_published', true),
        supabase.from('card_categories').select('card_id, categories(slug)').in('card_id', cardIds),
      ]);
      const cardRows = (cards.data ?? []) as Card[];
      if (cardRows.length > 0) {
        const bankById = new Map((banks.data ?? []).map((b: any) => [b.id, b as Bank]));
        const by = <T extends { card_id: string }>(rows: T[] | null) => {
          const m = new Map<string, T[]>();
          for (const r of rows ?? []) (m.get(r.card_id) ?? m.set(r.card_id, []).get(r.card_id)!).push(r);
          return m;
        };
        const rw = by(rewards.data as any), bo = by(bonuses.data as any), fe = by(fees.data as any),
          el = by(elig.data as any), ch = by(changes.data as any);
        const ratingByCard = new Map((ratings.data ?? []).map((r: any) => [r.card_id, r as CardRating]));
        const articleByCard = new Map((articles.data ?? []).map((a: any) => [a.related_card_id, a as Article]));
        const catsByCard = by((cats.data ?? []).map((r: any) => ({ card_id: r.card_id, slug: r.categories?.slug })) as any);
        for (const card of cardRows) {
          out.set(card.id, {
            card,
            bank: bankById.get(card.bank_id) as Bank,
            rating: ratingByCard.get(card.id) ?? null,
            rewardCategories: (rw.get(card.id) ?? []) as CardRewardCategory[],
            bonuses: (bo.get(card.id) ?? []) as CardBonus[],
            fees: (fe.get(card.id) ?? []) as CardFee[],
            eligibility: (el.get(card.id) ?? []) as CardEligibility[],
            changeLog: (ch.get(card.id) ?? []) as CardChangeLog[],
            article: articleByCard.get(card.id) ?? null,
            categorySlugs: ((catsByCard.get(card.id) ?? []) as { slug: string }[]).map((r) => r.slug).filter(Boolean),
          });
        }
        return out;
      }
    } catch (e) { warnOnce('cards:detailsBatch', (e as Error).message); }
  }
  // seed fallback
  for (const id of cardIds) {
    const card = seed.cardById[id];
    if (card) out.set(id, buildSeedDetail(card));
  }
  return out;
}

/** All card (bank-slug, card-slug) pairs for getStaticPaths. */
export async function getAllCardSlugs(): Promise<{ bankSlug: string; cardSlug: string }[]> {
  const seedSlugs = seed.cards.map((c) => ({
    bankSlug: seed.bankById[c.bank_id].slug,
    cardSlug: c.slug.replace(new RegExp(`^${seed.bankById[c.bank_id].slug}-`), ''),
  }));
  const rows = await liveArray<{ card_slug: string; bank_slug: string }>(
    'card_listing_view:slugs',
    () => getAnonClient().from('card_listing_view').select('card_slug, bank_slug'),
    [], // empty seed here; we map seedSlugs directly on fallback below
    false,
  );
  if (rows.length === 0) return seedSlugs;
  return rows.map((r) => ({
    bankSlug: r.bank_slug,
    cardSlug: r.card_slug.replace(new RegExp(`^${r.bank_slug}-`), ''),
  }));
}

/** Cards issued by one bank (for /banks/[bank]). */
export async function getCardsByBank(bankSlug: string): Promise<CardListingRow[]> {
  const all = await getCardListing();
  return all.filter((r) => r.bank_slug === bankSlug);
}

/* ----------------------------------------------------- Compare helpers ---- */
export async function getCardDetailById(cardId: string): Promise<CardDetail | null> {
  if (hasSupabaseEnv) {
    try {
      const { data: card, error } = await getAnonClient().from('cards').select('*').eq('id', cardId).maybeSingle();
      if (!error && card) return await assembleLiveDetail(card as Card);
    } catch (e) { warnOnce('cards:detailById', (e as Error).message); }
  }
  const card = seed.cardById[cardId];
  return card ? buildSeedDetail(card) : null;
}

/** Curated high-traffic compare pairs for prerendering /compare/[a]-vs-[b]. */
export async function getComparePairs(): Promise<{ a: string; b: string }[]> {
  // Curated, not the full N×N permutation (FRONTEND §8). Slugs are full card slugs.
  return [
    { a: 'hdfc-bank-millennia-credit-card', b: 'sbi-card-cashback-sbi-card' },
    { a: 'axis-bank-atlas-credit-card', b: 'american-express-platinum-travel-credit-card' },
    { a: 'icici-bank-amazon-pay-credit-card', b: 'hdfc-bank-swiggy-credit-card' },
    { a: 'hdfc-bank-regalia-gold-credit-card', b: 'axis-bank-magnus-credit-card' },
  ];
}

export async function getCardDetailByFullSlug(fullSlug: string): Promise<CardDetail | null> {
  if (hasSupabaseEnv) {
    try {
      const { data: card, error } = await getAnonClient().from('cards').select('*').eq('slug', fullSlug).maybeSingle();
      if (!error && card) return await assembleLiveDetail(card as Card);
      if (!error && !card) return null; // genuinely absent in live catalog
    } catch (e) { warnOnce('cards:detailByFullSlug', (e as Error).message); }
  }
  const card = seed.cardBySlug[fullSlug];
  return card ? buildSeedDetail(card) : null;
}

/* --------------------------------------------------------- Editorial ------ */
export async function getArticles(type?: Article['article_type']): Promise<Article[]> {
  const seedArticles = seed.articles
    .filter((a) => a.is_published && (!type || a.article_type === type))
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''));
  return liveArray<Article>(
    `articles${type ? `:${type}` : ''}`,
    () => {
      let q = getAnonClient().from('articles').select('*').eq('is_published', true).order('published_at', { ascending: false });
      if (type) q = q.eq('article_type', type);
      return q;
    },
    seedArticles,
  );
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const fallback = seed.articles.find((a) => a.slug === slug) ?? null;
  if (!hasSupabaseEnv) return fallback;
  try {
    const { data, error } = await getAnonClient().from('articles').select('*').eq('slug', slug).eq('is_published', true).maybeSingle();
    if (error) { warnOnce('articles:detail', error.message); return fallback; }
    return (data as Article) ?? fallback;
  } catch (e) { warnOnce('articles:detail', (e as Error).message); return fallback; }
}

export async function getAuthors(): Promise<Author[]> {
  return liveArray('authors', () => getAnonClient().from('authors').select('*'), seed.authors);
}

export async function getAuthorBySlug(slug: string): Promise<Author | null> {
  return (await getAuthors()).find((a) => a.slug === slug) ?? null;
}

export function getAuthorById(id: string | null): Author | null {
  if (!id) return null;
  return seed.authorById[id] ?? null;
}

/* ------------------------------------------------------- Change feed ------ */
export async function getChangeLog(): Promise<(CardChangeLog & { card_name: string; bank_name: string })[]> {
  const seedLog = seed.cardChangeLog
    .map((c) => {
      const card = seed.cardById[c.card_id];
      const bank = card ? seed.bankById[card.bank_id] : null;
      return { ...c, card_name: card?.name ?? '', bank_name: bank?.name ?? '' };
    })
    .sort((a, b) => b.detected_at.localeCompare(a.detected_at));
  if (!hasSupabaseEnv) return seedLog;
  try {
    const { data, error } = await getAnonClient()
      .from('card_change_log')
      .select('*, cards(name, banks(name))')
      .order('detected_at', { ascending: false });
    if (error) { warnOnce('card_change_log', error.message); return seedLog; }
    if (!data || data.length === 0) return seedLog;
    return (data as unknown[]).map((r) => {
      const row = r as CardChangeLog & { cards: { name: string; banks: { name: string } } };
      return { ...row, card_name: row.cards?.name ?? '', bank_name: row.cards?.banks?.name ?? '' };
    });
  } catch (e) { warnOnce('card_change_log', (e as Error).message); return seedLog; }
}

/** Recent change (last 6 months) for a card's review-page callout (§11.5). */
export function getRecentChangeForCard(cardId: string, changeLog: CardChangeLog[]): CardChangeLog | null {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 6);
  const recent = changeLog
    .filter((c) => new Date(c.detected_at) >= cutoff)
    .sort((a, b) => b.detected_at.localeCompare(a.detected_at));
  return recent[0] ?? null;
}

/* --------------------------------------- Lightweight card lookups (islands) */
/** Minimal card list for interactive pickers (compare, calculator, wallet). */
export async function getCardPickerList(): Promise<
  { id: string; name: string; bank_name: string; image_url: string | null; slug: string }[]
> {
  const listing = await getCardListing();
  return listing.map((r) => ({
    id: r.card_id, name: r.card_name, bank_name: r.bank_name,
    image_url: r.image_url, slug: r.card_slug,
  }));
}
