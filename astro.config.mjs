// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import node from '@astrojs/node';

// CardCompare.in — Astro hybrid rendering.
// Default output is static (SSG); routes that need on-demand rendering opt in
// with `export const prerender = false` (e.g. /wallet). The node adapter makes
// those on-demand routes runnable locally; swap to @astrojs/vercel or
// @astrojs/netlify at deploy time (see FRONTEND_PROMPT.md §2) with no code change.
// https://astro.build/config
export default defineConfig({
  site: 'https://cardcompare.in',
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), sitemap()],
  vite: {
    // Never leak the service-role key into the client bundle. Only PUBLIC_*
    // env vars are exposed to the client by Astro; this is belt-and-braces.
    define: {},
  },
});
