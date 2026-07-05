/*
 * SearchBox (FRONTEND §8). Calls the search_site RPC (§8) unioning card +
 * article results. Preview fallback: client-side filter over a lightweight index
 * passed from the server, so search works without a backend.
 */
import { useEffect, useMemo, useState } from 'react';
import '../styles/islands.css';
import { searchSite } from '../lib/edge-functions';

export interface IndexItem { type: 'card' | 'article'; title: string; subtitle: string; href: string; }
interface Props { index: IndexItem[]; initialQuery?: string; }

export default function SearchBox({ index, initialQuery = '' }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [live, setLive] = useState<IndexItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const previewResults = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return index.filter((i) => i.title.toLowerCase().includes(s) || i.subtitle.toLowerCase().includes(s)).slice(0, 20);
  }, [q, index]);

  const run = async (query: string) => {
    if (!query.trim()) { setLive(null); return; }
    setLoading(true);
    try {
      const res = await searchSite(query);
      setLive(res.map((r) => ({ type: r.result_type, title: r.title, subtitle: r.subtitle ?? '', href: r.result_type === 'card' ? `/cards/${r.slug}` : `/guides/${r.slug}` })));
    } catch {
      setLive(null); // fall back to client preview
    } finally { setLoading(false); }
  };

  useEffect(() => { if (initialQuery) run(initialQuery); }, []);

  const results = live ?? previewResults;

  return (
    <div className="island">
      <form onSubmit={(e) => { e.preventDefault(); run(q); }} role="search">
        <div className="field">
          <label htmlFor="site-search">Search cards and guides</label>
          <input id="site-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. cashback, HDFC, lounge access" autoComplete="off" />
        </div>
        <button className="btn-i btn-i--primary" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
      </form>

      <div aria-live="polite" style={{ marginTop: 'var(--space-8)' }}>
        {q.trim() && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-body-sm)' }}>{results.length} result{results.length === 1 ? '' : 's'} for "{q}"</p>}
        <ul className="opt-list">
          {results.map((r, i) => (
            <li key={i}>
              <a className="opt" href={r.href} style={{ textDecoration: 'none', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-1)' }}>
                <span style={{ fontWeight: 600 }}>{r.title}</span>
                <span style={{ fontSize: 'var(--text-body-sm)', color: 'var(--color-text-muted)', fontWeight: 400 }}>{r.type === 'card' ? 'Card' : 'Guide'} · {r.subtitle}</span>
              </a>
            </li>
          ))}
        </ul>
        {q.trim() && results.length === 0 && <p>No matches. Try a broader term.</p>}
      </div>
    </div>
  );
}
