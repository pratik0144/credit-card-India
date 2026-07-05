/*
 * RecommendWizard (FRONTEND §11.1, DESIGN §6.7 structural pattern).
 * One-topic-per-screen, 8-question wizard with persistent Back/Next. NO PAN, no
 * PII required to see results. Calls the recommend-cards Edge Function (§9.1) —
 * scoring stays server-side (§16). When no backend is configured, falls back to
 * a clearly-labelled preview using cards passed from the server.
 *
 * The verbatim trust sentence from §11.1 sits directly above the results.
 */
import { useMemo, useState } from 'react';
import '../styles/islands.css';
import { recommendCards } from '../lib/edge-functions';
import type { RecommendInput, RecommendResult } from '../lib/database.types';

interface PreviewCard { card_id: string; card_slug: string; card_name: string; overall_score: number | null; annual_fee_amount: number | null; headline_reward_line: string | null; }
interface Props { previewCards: PreviewCard[]; }

type Q = {
  key: keyof RecommendInput;
  title: string;
  multi?: boolean;
  max?: number;
  options: { value: string; label: string }[];
};

const QUESTIONS: Q[] = [
  { key: 'goal', title: 'What do you mainly want from a credit card?', options: [
    { value: 'cashback', label: 'Cashback' }, { value: 'travel_miles', label: 'Travel & miles' },
    { value: 'rewards_points', label: 'Rewards points' }, { value: 'fuel_savings', label: 'Fuel savings' },
    { value: 'first_card', label: 'My first credit card' }, { value: 'business', label: 'Business expenses' },
    { value: 'lounge_access', label: 'Airport lounge access' } ] },
  { key: 'monthly_spend_band', title: 'Roughly how much do you spend on cards each month?', options: [
    { value: 'lt20k', label: 'Under ₹20,000' }, { value: '20k_50k', label: '₹20,000 – ₹50,000' },
    { value: '50k_1l', label: '₹50,000 – ₹1 lakh' }, { value: '1l_3l', label: '₹1 lakh – ₹3 lakh' },
    { value: '3l_plus', label: '₹3 lakh+' } ] },
  { key: 'top_categories', title: 'Where do you spend the most? (pick up to 2)', multi: true, max: 2, options: [
    { value: 'groceries', label: 'Groceries & online shopping' }, { value: 'dining', label: 'Dining' },
    { value: 'travel_flights', label: 'Flights & travel' }, { value: 'fuel', label: 'Fuel' },
    { value: 'utility_bills', label: 'Utility bills' }, { value: 'emi_large_purchases', label: 'Large purchases (EMI)' } ] },
  { key: 'air_travel_frequency', title: 'How often do you fly?', options: [
    { value: 'never', label: 'Never' }, { value: '1_2_year', label: '1–2 times a year' },
    { value: '3_6_year', label: '3–6 times a year' }, { value: '7_plus_year', label: '7+ times a year' } ] },
  { key: 'employment_type', title: 'What best describes your employment?', options: [
    { value: 'salaried', label: 'Salaried' }, { value: 'self_employed', label: 'Self-employed' },
    { value: 'student', label: 'Student' }, { value: 'not_employed', label: 'Not currently employed' } ] },
  { key: 'annual_income_band', title: 'What is your annual income?', options: [
    { value: 'lt3l', label: 'Under ₹3 lakh' }, { value: '3_6l', label: '₹3 – 6 lakh' },
    { value: '6_12l', label: '₹6 – 12 lakh' }, { value: '12_25l', label: '₹12 – 25 lakh' },
    { value: '25l_plus', label: '₹25 lakh+' } ] },
  { key: 'cibil_band', title: 'Your best estimate of your CIBIL score?', options: [
    { value: '750_plus', label: '750+ (Excellent)' }, { value: '700_749', label: '700–749 (Good)' },
    { value: '650_699', label: '650–699 (Fair)' }, { value: 'new_to_credit', label: 'New to credit' },
    { value: 'not_sure', label: 'Not sure' } ] },
  { key: 'fee_preference', title: 'How do you feel about annual fees?', options: [
    { value: 'lifetime_free_only', label: 'Prefer lifetime-free only' },
    { value: 'value_over_3x', label: 'Okay with a fee if the value is clearly worth it' },
    { value: 'no_preference', label: 'No preference' } ] },
];

export default function RecommendWizard({ previewCards }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [results, setResults] = useState<RecommendResult[] | null>(null);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  const q = QUESTIONS[step];
  const total = QUESTIONS.length;
  const isLast = step === total - 1;
  const current = answers[q.key as string];

  const canProceed = q.multi ? Array.isArray(current) && current.length > 0 : Boolean(current);

  const select = (value: string) => {
    if (q.multi) {
      const arr = Array.isArray(current) ? [...current] : [];
      const i = arr.indexOf(value);
      if (i >= 0) arr.splice(i, 1);
      else if (arr.length < (q.max ?? 99)) arr.push(value);
      setAnswers({ ...answers, [q.key]: arr });
    } else {
      setAnswers({ ...answers, [q.key]: value });
    }
  };

  const submit = async () => {
    setLoading(true);
    const input = answers as unknown as RecommendInput;
    try {
      const res = await recommendCards(input);
      setResults(res);
    } catch {
      // No backend — labelled preview from server-passed cards.
      setPreview(true);
      setResults(previewCards.slice(0, 3).map((c) => ({
        card_id: c.card_id, card_slug: c.card_slug, card_name: c.card_name,
        total_score: Math.round((c.overall_score ?? 4) * 20),
        subscores: { category_match: 0, net_value: 0, travel_fit: 0, fee_pref: 0, editorial_prior: 0 },
        reasons: [c.headline_reward_line ?? 'A strong all-round pick', c.annual_fee_amount === 0 ? 'No annual fee' : 'Editorial favourite'],
        estimated_annual_value_inr: 0, fee_waiver_note: null,
      })));
    } finally {
      setLoading(false);
    }
  };

  const progress = useMemo(() => (results ? 100 : ((step) / total) * 100), [step, results]);

  if (results) {
    return (
      <div className="island">
        {preview && (
          <p className="island__notice">Preview mode — connect the recommendation Edge Function to see real scores and estimated annual value. These are illustrative editorial picks.</p>
        )}
        {/* §11.1 verbatim trust copy, directly above results */}
        <p className="island__trust">These are estimates based on your answers and each issuer's published eligibility criteria — not a bureau-verified check. Actual approval depends on the issuer's own review of your application.</p>
        <h2>Your top matches</h2>
        <div aria-live="polite">
          {results.map((r, i) => (
            <article className="result-card" key={r.card_id}>
              <div className="result-card__head">
                <div>
                  {i === 0 && <span className="result-card__label">Best overall</span>}
                  <h3><a href={`/cards/${r.card_slug.split('-')[0]}/${r.card_slug}`}>{r.card_name}</a></h3>
                </div>
                <span className="result-card__score">{r.total_score}</span>
              </div>
              <ul className="result-card__reasons">{r.reasons.map((x, j) => <li key={j}>{x}</li>)}</ul>
              {r.estimated_annual_value_inr > 0 && (
                <p className="result-card__value">Estimated value: ₹{new Intl.NumberFormat('en-IN').format(r.estimated_annual_value_inr)}/year</p>
              )}
              {r.fee_waiver_note && <p>{r.fee_waiver_note}</p>}
              <div>
                <a className="btn-i btn-i--primary" href={`/cards/${r.card_slug.split('-')[0]}/${r.card_slug}`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Read review &amp; apply</a>
              </div>
            </article>
          ))}
        </div>
        <button className="btn-i btn-i--ghost" onClick={() => { setResults(null); setStep(0); }}>Start over</button>
      </div>
    );
  }

  return (
    <div className="island">
      <div className="wizard__progress"><div className="wizard__progress-bar" style={{ width: `${progress}%` }} /></div>
      <p className="wizard__step-count">Question {step + 1} of {total}</p>
      <h2 className="wizard__question" aria-live="polite">{q.title}</h2>

      <ul className="opt-list">
        {q.options.map((opt) => {
          const selected = q.multi ? Array.isArray(current) && current.includes(opt.value) : current === opt.value;
          return (
            <li key={opt.value}>
              <button
                type="button"
                className={`opt${selected ? ' opt--selected' : ''}`}
                aria-pressed={selected}
                onClick={() => select(opt.value)}
              >
                <span className="opt__check" aria-hidden="true">{selected ? '✓' : ''}</span>
                {opt.label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="wizard__nav">
        <button className="btn-i btn-i--ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</button>
        {isLast ? (
          <button className="btn-i btn-i--primary" onClick={submit} disabled={!canProceed || loading}>
            {loading ? 'Finding your matches…' : 'See my matches'}
          </button>
        ) : (
          <button className="btn-i btn-i--primary" onClick={() => setStep((s) => s + 1)} disabled={!canProceed}>Next</button>
        )}
      </div>
    </div>
  );
}
