/*
 * CompareTool (FRONTEND §8, DESIGN §6.6). Interactive picker: search/add up to
 * 3 cards, render a real semantic comparison table (column per card). Reads an
 * initial ?add=<slug> from the URL (from CardRow "Add to Compare"). Zero backend
 * needed — operates on card data passed from the server.
 */
import { useMemo, useState, useEffect } from 'react';
import '../styles/islands.css';

export interface CompareCard {
  id: string; slug: string; name: string; bank_name: string; image_url: string | null;
  annual_fee: string; reward_rate: string; rating: string; cibil: string; forex: string; lounge: string;
  reviewHref: string; applyHref: string;
}
interface Props { cards: CompareCard[]; }
const MAX = 3;

export default function CompareTool({ cards }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const add = new URLSearchParams(window.location.search).get('add');
    if (add) {
      const found = cards.find((c) => c.slug === add || c.slug.endsWith(add));
      if (found) setSelected([found.id]);
    }
  }, []);

  const chosen = selected.map((id) => cards.find((c) => c.id === id)!).filter(Boolean);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return cards.filter((c) => !selected.includes(c.id) && (c.name.toLowerCase().includes(q) || c.bank_name.toLowerCase().includes(q))).slice(0, 6);
  }, [query, selected]);

  const add = (id: string) => { if (selected.length < MAX) { setSelected([...selected, id]); setQuery(''); } };
  const remove = (id: string) => setSelected(selected.filter((x) => x !== id));

  const rows: [string, (c: CompareCard) => string][] = [
    ['Our rating', (c) => c.rating], ['Reward rate', (c) => c.reward_rate], ['Annual fee', (c) => c.annual_fee],
    ['Forex markup', (c) => c.forex], ['Lounge access', (c) => c.lounge], ['Min. CIBIL', (c) => c.cibil],
  ];

  return (
    <div className="island island--wide">
      <div className="field">
        <label htmlFor="cmp-search">Add a card to compare (up to 3)</label>
        <input id="cmp-search" type="search" placeholder="Search by card or bank…" value={query}
          onChange={(e) => setQuery(e.target.value)} disabled={selected.length >= MAX} autoComplete="off" />
      </div>
      {matches.length > 0 && (
        <ul className="opt-list" style={{ marginTop: 'calc(-1 * var(--space-4))' }}>
          {matches.map((c) => (
            <li key={c.id}><button type="button" className="opt" onClick={() => add(c.id)}>+ {c.name} <span style={{ color: 'var(--color-text-muted)' }}>· {c.bank_name}</span></button></li>
          ))}
        </ul>
      )}
      {selected.length >= MAX && <p style={{ fontSize: 'var(--text-body-sm)', color: 'var(--color-text-muted)' }}>You can compare up to {MAX} cards. Remove one to add another.</p>}

      {chosen.length === 0 ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Search above to add cards, then compare them side by side.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="assign-table" style={{ minWidth: 480 }}>
            <caption className="sr-only">Side-by-side card comparison</caption>
            <thead>
              <tr>
                <th scope="col"></th>
                {chosen.map((c) => (
                  <th scope="col" key={c.id}>
                    <img src={c.image_url ? `/card-img/${c.image_url.replace(/^card-img\//, '')}` : '/og-default.png'} alt={`${c.name}`} width="110" height="69" style={{ display: 'block', marginBottom: 'var(--space-2)' }} />
                    <a href={c.reviewHref}>{c.name}</a>
                    <button type="button" onClick={() => remove(c.id)} aria-label={`Remove ${c.name}`} style={{ display: 'block', marginTop: 'var(--space-1)', background: 'none', border: 'none', color: 'var(--color-primary-blue)', cursor: 'pointer', padding: 0 }}>Remove</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, get]) => (
                <tr key={label}><th scope="row">{label}</th>{chosen.map((c) => <td key={c.id}>{get(c)}</td>)}</tr>
              ))}
              <tr><th scope="row">Apply</th>{chosen.map((c) => <td key={c.id}><a className="btn-i btn-i--primary" href={c.applyHref} target="_blank" rel="nofollow sponsored noopener" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', fontSize: 'var(--text-body-sm)' }}>Apply Now</a></td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
