/*
 * Supabase client factories. FRONTEND_PROMPT.md §2 / BACKEND §12:
 *  - The anon client is safe for the browser and for build-time queries of
 *    public data (RLS enforces the read boundary).
 *  - The service-role client is server-only (build scripts, SSR routes that
 *    genuinely need it). It must NEVER be imported into a client island or
 *    exposed through a PUBLIC_ env var.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PUBLIC_URL = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const PUBLIC_ANON = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

/**
 * Anon client — public reads, client-side, and prerender build queries.
 * Returns null-safe usage: during scaffold (no env yet) callers should handle
 * a thrown error and fall back to seed/mock data.
 */
export function getAnonClient(): SupabaseClient {
  if (!PUBLIC_URL || !PUBLIC_ANON) {
    throw new Error(
      'Supabase env not configured: set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env',
    );
  }
  return createClient(PUBLIC_URL, PUBLIC_ANON, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

/** True when public Supabase env is present — lets pages choose seed vs live. */
export const hasSupabaseEnv = Boolean(PUBLIC_URL && PUBLIC_ANON);

/**
 * Service-role client — SERVER ONLY. Guards against accidental client import
 * by checking that we're not in a browser context.
 */
export function getServiceClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('getServiceClient() must never be called in the browser.');
  }
  const url = process.env.SUPABASE_URL ?? PUBLIC_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (server env).');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
