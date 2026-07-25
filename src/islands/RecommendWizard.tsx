/*
 * RecommendWizard (FRONTEND §11.1) — the site's core "which card is right for
 * you?" flow. An adaptive 10-question wizard: the questions branch on prior
 * answers (a traveller gets flight/forex questions, a first-timer gets credit-
 * history questions) via orderedQuestions(). Numeric questions accept digits
 * only. On submit it runs the client-side recommend-engine over the card data
 * shipped from the server and shows results ranked 1..N by estimated annual
 * value, each with the reasons. No PAN, no bureau pull. Server scoring stays the
 * canonical source; this engine mirrors it (see recommend-engine.ts).
 */
import { useMemo, useState } from 'react';
import '../styles/islands.css';
import {
  orderedQuestions, canAdvance, toRecommendAnswers, TOTAL_QUESTIONS,
  type AnswerMap, type Question,
} from '../lib/recommend-questions';
import {
  recommendCards, type RecommendCandidate, type PointValuationLite, type RankedRecommendation,
} from '../lib/recommend-engine';

interface Props {
  candidates: RecommendCandidate[];
  valuations: PointValuationLite[];
}

type Phase = 'quiz' | 'analysing' | 'results';

const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN').format(Math.round(n))}`;
const digitsOnly = (s: string) => s.replace(/[^\d]/g, '');

export default function RecommendWizard({ candidates, valuations }: Props) {
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('quiz');
  const [results, setResults] = useState<RankedRecommendation[] | null>(null);
  const [eligibleCount, setEligibleCount] = useState(0);

  const questions = useMemo(() => orderedQuestions(answers), [answers]);
  const q = questions[step];
  const value = answers[q.id];
  const proceed = canAdvance(q, value);

  const set = (id: string, v: AnswerMap[string]) => setAnswers((a) => ({ ...a, [id]: v }));

  const selectSingle = (v: string) => set(q.id, v);
  const toggleMulti = (v: string) => {
    const cur = Array.isArray(value) ? [...(value as string[])] : [];
    const i = cur.indexOf(v);
    if (i >= 0) cur.splice(i, 1);
    else if (cur.length < (q.max ?? 99)) cur.push(v);
    set(q.id, cur);
  };
  const setNumber = (raw: string) => {
    const digits = digitsOnly(raw);
    set(q.id, digits === '' ? (undefined as unknown as number) : Number(digits));
  };
  const setGroupNumber = (key: string, raw: string) => {
    const digits = digitsOnly(raw);
    const cur = { ...((value as Record<string, number>) ?? {}) };
    if (digits === '') delete cur[key];
    else cur[key] = Number(digits);
    set(q.id, cur);
  };

  const back = () => setStep((s) => Math.max(0, s - 1));
  const next = () => {
    if (step < TOTAL_QUESTIONS - 1) { setStep((s) => s + 1); return; }
    runEngine();
  };

  const runEngine = () => {
    setPhase('analysing');
    // A short, deliberate analysis pause — the engine is fast, but the work is
    // real and users trust a considered answer more than an instant one.
    window.setTimeout(() => {
      const input = toRecommendAnswers(answers);
      const { ranked, eligibleCount } = recommendCards(candidates, input, valuations, 5);
      setResults(ranked);
      setEligibleCount(eligibleCount);
      setPhase('results');
    }, 900);
  };

  const restart = () => { setAnswers({}); setStep(0); setResults(null); setPhase('quiz'); };

  /* ---------------------------------------------------------- results --- */
  if (phase === 'results' && results) {
    return (
      <div className="island">
        <p className="island__trust">These are estimates based on your answers and each issuer's published eligibility criteria, not a bureau-verified check. Actual approval depends on the issuer's own review of your application.</p>
        {results.length === 0 ? (
          <div className="analysis">
            <h2>No confident matches yet</h2>
            <p>None of the cards we track are a clear fit for the income, CIBIL and age you entered. Try widening your answers, or browse cards by category.</p>
            <a className="btn-i btn-i--primary" href="/discover" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Browse all cards</a>
          </div>
        ) : (
          <>
            <h2>Your top matches</h2>
            <p className="wizard__step-count">Ranked by estimated annual value on your spending, from {eligibleCount} eligible cards.</p>
            <ol className="rank-list">
              {results.map((r) => (
                <li className={`rank-card${r.rank === 1 ? ' rank-card--top' : ''}`} key={r.card_id}>
                  <div className="rank-card__head">
                    <span className="rank-card__badge" aria-hidden="true">{r.rank}</span>
                    <div className="rank-card__id">
                      <h3><a href={r.review_path}>{r.card_name}</a></h3>
                      <p className="rank-card__bank">{r.bank_name} · {r.fee_note}</p>
                    </div>
                    <div className="rank-card__value">
                      <strong>{inr(r.estimated_annual_value_inr)}</strong>
                      <span>est. value / yr</span>
                    </div>
                  </div>
                  <p className="rank-card__why-label">Why #{r.rank}</p>
                  <ul className="rank-card__why">
                    {r.reasons.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                  {r.first_year_value_inr !== r.estimated_annual_value_inr && (
                    <p className="rank-card__note">First-year value about {inr(r.first_year_value_inr)} with welcome benefits, minus any joining fee.</p>
                  )}
                  <div style={{ marginTop: 'var(--space-4)' }}>
                    <a className="btn-i btn-i--primary" href={r.review_path} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Read review &amp; apply</a>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
        <button className="btn-i btn-i--ghost" onClick={restart} style={{ marginTop: 'var(--space-6)' }}>Start over</button>
      </div>
    );
  }

  /* -------------------------------------------------------- analysing --- */
  if (phase === 'analysing') {
    return (
      <div className="island">
        <div className="analysis" aria-live="polite">
          <div className="analysis__spinner" aria-hidden="true"></div>
          <h2>Analysing {candidates.length} cards…</h2>
          <p>Scoring each card on your spending, applying reward caps, fees and eligibility.</p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- quiz --- */
  const progress = (step / TOTAL_QUESTIONS) * 100;

  return (
    <div className="island">
      <div className="wizard__progress" aria-hidden="true">
        <div className="wizard__progress-bar" style={{ width: `${progress}%` }}></div>
      </div>
      <p className="wizard__step-count">Question {step + 1} of {TOTAL_QUESTIONS}</p>
      <h2 className="wizard__question">{q.title}</h2>
      {q.help && <p className="wizard__help">{q.help}</p>}

      {q.kind === 'single' && (
        <ul className="opt-list">
          {q.options!.map((o) => {
            const on = value === o.value;
            return (
              <li key={o.value}>
                <button type="button" className={`opt${on ? ' opt--selected' : ''}`} aria-pressed={on} onClick={() => selectSingle(o.value)}>
                  <span className="opt__check" aria-hidden="true"></span>{o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q.kind === 'multi' && (
        <ul className="opt-list">
          {q.options!.map((o) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const on = arr.includes(o.value);
            const full = arr.length >= (q.max ?? 99) && !on;
            return (
              <li key={o.value}>
                <button type="button" className={`opt${on ? ' opt--selected' : ''}`} aria-pressed={on} disabled={full} onClick={() => toggleMulti(o.value)}>
                  <span className="opt__check" aria-hidden="true"></span>{o.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {q.kind === 'number' && (
        <div className="num-field">
          <input
            className="num-input"
            type="text" inputMode="numeric" pattern="[0-9]*"
            autoComplete="off"
            value={value != null ? String(value) : ''}
            onChange={(e) => setNumber(e.target.value)}
            placeholder={q.placeholder}
            aria-label={q.title}
          />
          {q.unit && <span className="num-unit">{q.unit}</span>}
        </div>
      )}

      {q.kind === 'number_group' && (
        <div className="num-group">
          {(q.fields ?? []).map((f) => {
            const rec = (value as Record<string, number>) ?? {};
            return (
              <label className="num-row" key={f.key}>
                <span className="num-row__label">{f.label}</span>
                <span className="num-field num-field--sm">
                  <input
                    className="num-input"
                    type="text" inputMode="numeric" pattern="[0-9]*"
                    autoComplete="off"
                    value={rec[f.key] != null ? String(rec[f.key]) : ''}
                    onChange={(e) => setGroupNumber(f.key, e.target.value)}
                    placeholder="0"
                    aria-label={f.label}
                  />
                  <span className="num-unit">{q.unit}</span>
                </span>
              </label>
            );
          })}
        </div>
      )}

      <div className="wizard__nav">
        <button className="btn-i btn-i--ghost" onClick={back} disabled={step === 0}>Back</button>
        <button className="btn-i btn-i--primary" onClick={next} disabled={!proceed}>
          {step < TOTAL_QUESTIONS - 1 ? 'Next' : 'See my matches'}
        </button>
      </div>
    </div>
  );
}
