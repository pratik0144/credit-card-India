/*
 * BestCardCalculator (FRONTEND §11.3). Category + amount inputs and a type-to-
 * search card picker (up to 6). On "Find the best card" it runs the shared
 * ranking engine (best-card-engine.ts) over the chosen cards, producing a ranked
 * 1/2/3 list with the estimated rupee value and a plain-language "why" for each.
 * The engine mirrors the server-side scoring so results stay consistent whether
 * they come from live data or the seed fallback. Also embeddable on review pages.
 */
import { useState, useRef, useMemo } from 'react';
import '../styles/islands.css';
import { SPEND_CATEGORY_KEYS, SPEND_CATEGORY_LABELS, type SpendCategoryKey } from '../lib/taxonomy';
import { rankCardsForPurchase, type BestCardCandidate, type PointValuationLite, type RankedCard } from '../lib/best-card-engine';

interface Props {
  candidates: BestCardCandidate[];
  valuations: PointValuationLite[];
  compact?: boolean;
}

export default function BestCardCalculator({ candidates, valuations, compact = false }: Props) {
  const [category, setCategory] = useState<SpendCategoryKey>('dining');
  const [amount, setAmount] = useState(3000);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RankedCard[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(candidates.map((c) => [c.id, c])), [candidates]);
  const nameOf = (id: string) => byId.get(id)?.name ?? id;

  const filtered = query.trim().length > 0
    ? candidates.filter((c) =>
        !picked.includes(c.id) &&
        `${c.name} ${c.bank_name}`.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : [];

  const add = (id: string) => {
    if (picked.length < 6) setPicked((p) => [...p, id]);
    setQuery('');
    inputRef.current?.focus();
  };
  const remove = (id: string) => setPicked((p) => p.filter((x) => x !== id));

  const run = () => {
    const chosen = picked.map((id) => byId.get(id)).filter((c): c is BestCardCandidate => Boolean(c));
    setResults(rankCardsForPurchase(chosen, category, amount, valuations));
  };

  return (
    <div className={compact ? '' : 'island'}>
      <div className="field">
        <label htmlFor="calc-cat">Spend category</label>
        <select id="calc-cat" value={category} onChange={(e) => setCategory(e.target.value as SpendCategoryKey)}>
          {SPEND_CATEGORY_KEYS.map((k) => <option key={k} value={k}>{SPEND_CATEGORY_LABELS[k]}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="calc-amt">Amount (₹)</label>
        <input id="calc-amt" type="number" inputMode="numeric" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </div>

      <div className="field">
        <label htmlFor="calc-search">Add cards to compare <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(up to 6)</span></label>
        {picked.length > 0 && (
          <div className="card-chips" role="list" aria-label="Selected cards">
            {picked.map((id) => (
              <span className="card-chip" role="listitem" key={id}>
                {nameOf(id)}
                <button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => remove(id)}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="search-wrap">
          <input
            ref={inputRef}
            id="calc-search"
            type="search"
            autoComplete="off"
            placeholder="Search by card or bank name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={picked.length >= 6}
            aria-expanded={filtered.length > 0}
            aria-autocomplete="list"
            aria-controls="calc-search-results"
          />
          {filtered.length > 0 && (
            <ul id="calc-search-results" className="search-results" role="listbox">
              {filtered.map((c) => (
                <li key={c.id} role="option" aria-selected={false}>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); add(c.id); }}>
                    <span>{c.name}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-caption)' }}>{c.bank_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button className="btn-i btn-i--primary" onClick={run} disabled={picked.length === 0}>Find the best card</button>

      {results && (
        <div aria-live="polite" style={{ marginTop: 'var(--space-8)' }}>
          <p className="island__trust">Ranked by estimated value on this one purchase. Value varies by how you redeem: statement credit, vouchers, or flight transfers can differ significantly. Monthly reward caps you have already used are not visible here.</p>
          {results.length === 0 && <p>Add at least one card to compare.</p>}
          <ol className="rank-list">
            {results.map((r) => (
              <li className={`rank-card${r.rank === 1 ? ' rank-card--top' : ''}`} key={r.card_id}>
                <div className="rank-card__head">
                  <span className="rank-card__badge" aria-hidden="true">{r.rank}</span>
                  <div className="rank-card__id">
                    <h3>{r.card_name}</h3>
                    <p className="rank-card__bank">{r.bank_name}</p>
                  </div>
                  <div className="rank-card__value">
                    <strong>₹{new Intl.NumberFormat('en-IN').format(r.estimated_value_inr)}</strong>
                    <span>est. value</span>
                  </div>
                </div>
                <p className="rank-card__why-label">Why{r.rank === 1 ? ' it wins' : ` #${r.rank}`}</p>
                <ul className="rank-card__why">
                  {r.why.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
                <p className="rank-card__note">{r.redemption_note}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
