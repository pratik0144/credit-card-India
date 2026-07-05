/*
 * BestCardCalculator (FRONTEND §11.3). Category + amount inputs, pick up to 6
 * cards, calls best-card-for-purchase (§9.3). Ranked ₹-value output with the
 * redemption caveat and milestone nudge. Also embeddable on review pages.
 */
import { useState } from 'react';
import '../styles/islands.css';
import { bestCardForPurchase } from '../lib/edge-functions';
import { SPEND_CATEGORY_KEYS, SPEND_CATEGORY_LABELS, type SpendCategoryKey } from '../lib/taxonomy';
import type { BestCardResult } from '../lib/database.types';

interface PickCard { id: string; name: string; bank_name: string; }
interface Props { cards: PickCard[]; compact?: boolean; }

export default function BestCardCalculator({ cards, compact = false }: Props) {
  const [category, setCategory] = useState<SpendCategoryKey>('dining');
  const [amount, setAmount] = useState(3000);
  const [picked, setPicked] = useState<string[]>(cards.slice(0, 3).map((c) => c.id));
  const [results, setResults] = useState<(BestCardResult & { name?: string })[] | null>(null);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 6 ? [...p, id] : p));
  const nameOf = (id: string) => cards.find((c) => c.id === id)?.name ?? id;

  const run = async () => {
    setLoading(true);
    try {
      const res = await bestCardForPurchase({ category_key: category, amount_inr: amount, card_ids: picked });
      setResults(res.map((r) => ({ ...r, name: r.card_name ?? nameOf(r.card_id) })));
    } catch {
      setPreview(true);
      setResults(picked.map((id) => ({ card_id: id, name: nameOf(id), estimated_value_inr: 0, redemption_note: 'Connect the calculator Edge Function to see estimated value.', milestone_nudge: null })));
    } finally { setLoading(false); }
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
      <fieldset style={{ border: 'none', padding: 0, margin: '0 0 var(--space-4)' }}>
        <legend style={{ fontWeight: 500, fontSize: 'var(--text-body-sm)', marginBottom: 'var(--space-2)' }}>Compare cards (up to 6)</legend>
        <ul className="opt-list">
          {cards.map((c) => {
            const on = picked.includes(c.id);
            return (
              <li key={c.id}>
                <button type="button" className={`opt${on ? ' opt--selected' : ''}`} aria-pressed={on} onClick={() => toggle(c.id)}>
                  <span className="opt__check" aria-hidden="true">{on ? '✓' : ''}</span>{c.name} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>· {c.bank_name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <button className="btn-i btn-i--primary" onClick={run} disabled={loading || picked.length === 0}>{loading ? 'Calculating…' : 'Find the best card'}</button>

      {results && (
        <div aria-live="polite" style={{ marginTop: 'var(--space-8)' }}>
          {preview && <p className="island__notice">Preview mode — connect the Edge Function for live ₹-value estimates.</p>}
          <p className="island__trust">Estimated value varies by how you redeem — statement credit, vouchers, or flight transfers can differ significantly.</p>
          {results.map((r, i) => (
            <article className="result-card" key={r.card_id}>
              <div className="result-card__head">
                <h3>{i === 0 ? '🏆 ' : ''}{r.name}</h3>
                {r.estimated_value_inr > 0 && <span className="result-card__score">₹{new Intl.NumberFormat('en-IN').format(r.estimated_value_inr)}</span>}
              </div>
              <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--text-body-sm)' }}>{r.redemption_note}</p>
              {r.milestone_nudge && <p style={{ margin: 0, color: 'var(--color-primary-blue)', fontSize: 'var(--text-body-sm)' }}>{r.milestone_nudge}</p>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
