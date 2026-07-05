/*
 * ComboOptimizer (FRONTEND §11.2). Per-category monthly-spend inputs + max-cards
 * toggle + eligibility, calls optimize-combo (§9.2). Renders the per-category
 * "use this card for X" assignment table as the centerpiece, totals, redundancy
 * warnings, and one alternate combo. Framed plainly as a heuristic estimate.
 */
import { useState } from 'react';
import '../styles/islands.css';
import { optimizeCombo } from '../lib/edge-functions';
import { SPEND_CATEGORY_KEYS, SPEND_CATEGORY_LABELS, type SpendCategoryKey } from '../lib/taxonomy';
import type { ComboResult } from '../lib/database.types';

interface Props { cardNames: Record<string, string>; }

const DEFAULT_SPEND: Partial<Record<SpendCategoryKey, number>> = {
  groceries: 15000, dining: 8000, travel_flights: 10000, fuel: 5000, utility_bills: 4000, online_shopping: 10000,
};

export default function ComboOptimizer({ cardNames }: Props) {
  const [spend, setSpend] = useState<Partial<Record<SpendCategoryKey, number>>>(DEFAULT_SPEND);
  const [maxCards, setMaxCards] = useState<2 | 3>(2);
  const [income, setIncome] = useState('6_12l');
  const [cibil, setCibil] = useState('700_749');
  const [emp, setEmp] = useState('salaried');
  const [results, setResults] = useState<ComboResult[] | null>(null);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  const nameOf = (id: string) => cardNames[id] ?? id;

  const run = async () => {
    setLoading(true);
    try {
      const res = await optimizeCombo({
        category_spend: spend, max_cards: maxCards,
        eligibility: { employment_type: emp as any, annual_income_band: income as any, cibil_band: cibil as any },
      });
      setResults(res);
    } catch {
      setPreview(true);
      setResults([]);
    } finally { setLoading(false); }
  };

  return (
    <div className="island">
      <p className="island__trust">This is a heuristic estimate based on published reward rates — not a guarantee. Actual redemption value varies by how you use points, miles, or cashback.</p>

      <h2>Your monthly spend</h2>
      <div className="grid-2">
        {SPEND_CATEGORY_KEYS.filter((k) => k !== 'general' && k !== 'other' && k !== 'entertainment' && k !== 'travel_hotels' && k !== 'emi_large_purchases').map((k) => (
          <div className="field" key={k}>
            <label htmlFor={`sp-${k}`}>{SPEND_CATEGORY_LABELS[k]} (₹/month)</label>
            <input id={`sp-${k}`} type="number" inputMode="numeric" min={0} value={spend[k] ?? 0}
              onChange={(e) => setSpend({ ...spend, [k]: Number(e.target.value) })} />
          </div>
        ))}
      </div>

      <h2>Preferences</h2>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="maxc">Max cards</label>
          <select id="maxc" value={maxCards} onChange={(e) => setMaxCards(Number(e.target.value) as 2 | 3)}>
            <option value={2}>2 cards</option><option value={3}>3 cards</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="emp">Employment</label>
          <select id="emp" value={emp} onChange={(e) => setEmp(e.target.value)}>
            <option value="salaried">Salaried</option><option value="self_employed">Self-employed</option>
            <option value="student">Student</option><option value="not_employed">Not employed</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="inc">Annual income</label>
          <select id="inc" value={income} onChange={(e) => setIncome(e.target.value)}>
            <option value="lt3l">Under ₹3L</option><option value="3_6l">₹3–6L</option>
            <option value="6_12l">₹6–12L</option><option value="12_25l">₹12–25L</option><option value="25l_plus">₹25L+</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="cib">CIBIL band</label>
          <select id="cib" value={cibil} onChange={(e) => setCibil(e.target.value)}>
            <option value="750_plus">750+</option><option value="700_749">700–749</option>
            <option value="650_699">650–699</option><option value="not_sure">Not sure</option>
          </select>
        </div>
      </div>
      <button className="btn-i btn-i--primary" onClick={run} disabled={loading}>{loading ? 'Optimising…' : 'Find my best combo'}</button>

      {results && (
        <div aria-live="polite" style={{ marginTop: 'var(--space-8)' }}>
          {preview && <p className="island__notice">Preview mode — connect the optimize-combo Edge Function to compute a live combo from the full catalog.</p>}
          {results.map((combo, idx) => (
            <div key={idx} className="result-card">
              <span className="result-card__label">{idx === 0 ? 'Recommended combo' : 'Alternate'}</span>
              <h3>{combo.cards.map((c) => nameOf(c.card_id)).join(' + ')}</h3>
              <table className="assign-table">
                <thead><tr><th>Category</th><th>Best card</th></tr></thead>
                <tbody>
                  {Object.entries(combo.per_category_assignment).map(([cat, cardId]) => (
                    <tr key={cat}><td>{SPEND_CATEGORY_LABELS[cat as SpendCategoryKey] ?? cat}</td><td>{nameOf(cardId as string)}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="totals">
                <div><strong>₹{new Intl.NumberFormat('en-IN').format(combo.total_annual_reward_value_inr)}</strong><span>annual rewards</span></div>
                <div><strong>₹{new Intl.NumberFormat('en-IN').format(combo.total_annual_fees_inr)}</strong><span>annual fees</span></div>
                <div><strong>₹{new Intl.NumberFormat('en-IN').format(combo.net_value_inr)}</strong><span>net value</span></div>
              </div>
              {combo.warnings.map((w, i) => <p className="warning" key={i}>⚠ {w}</p>)}
            </div>
          ))}
          {results.length === 0 && !preview && <p>No eligible combo found for these inputs.</p>}
        </div>
      )}
    </div>
  );
}
