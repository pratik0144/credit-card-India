/*
 * Typed wrappers for the Supabase Edge Functions (BACKEND_PROMPT.md §9).
 * The frontend MUST call these rather than reimplementing scoring client-side
 * (FRONTEND_PROMPT.md §10, §16) — the logic stays server-side so the two can't
 * drift. Each wrapper invokes the corresponding function via supabase.functions.
 */
import { getAnonClient } from './supabase';
import type {
  RecommendInput, RecommendResult,
  ComboInput, ComboResult,
  BestCardInput, BestCardResult,
  SearchResult,
} from './database.types';

async function invoke<TOut>(name: string, body: unknown): Promise<TOut> {
  const supabase = getAnonClient();
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) throw error;
  return data as TOut;
}

/** §9.1 — rule-based estimate; NOT a bureau-verified check (see §11.1 trust copy). */
export function recommendCards(input: RecommendInput): Promise<RecommendResult[]> {
  return invoke<RecommendResult[]>('recommend-cards', input);
}

/** §9.2 — greedy marginal-value combo heuristic; returns primary + one alternate. */
export function optimizeCombo(input: ComboInput): Promise<ComboResult[]> {
  return invoke<ComboResult[]>('optimize-combo', input);
}

/** §9.3 — ranked best card for a single purchase. */
export function bestCardForPurchase(input: BestCardInput): Promise<BestCardResult[]> {
  return invoke<BestCardResult[]>('best-card-for-purchase', input);
}

/** §8 — full-text search across cards + articles via the search_site RPC. */
export async function searchSite(query: string): Promise<SearchResult[]> {
  const supabase = getAnonClient();
  const { data, error } = await supabase.rpc('search_site', { query });
  if (error) throw error;
  return (data ?? []) as SearchResult[];
}
