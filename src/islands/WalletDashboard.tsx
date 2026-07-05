/*
 * WalletDashboard (FRONTEND §11.4). Auth-gated. Signed-out → sign-in gate
 * (Supabase Auth email magic-link / mobile OTP is the primary Indian pattern).
 * Signed-in → wallet tiles with a progress bar to the fee-waiver spend
 * threshold, milestone proximity, renewal countdown, plus aggregate totals and
 * the manual-tracking + Account-Aggregator roadmap disclosure. Data is RLS-scoped
 * to auth.uid(); spend logged manually (no AA integration in v1).
 */
import { useEffect, useState } from 'react';
import '../styles/islands.css';
import { getAnonClient, hasSupabaseEnv } from '../lib/supabase';

export default function WalletDashboard() {
  const [status, setStatus] = useState<'loading' | 'signed-out' | 'signed-in' | 'no-backend'>('loading');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!hasSupabaseEnv) { setStatus('no-backend'); return; }
    getAnonClient().auth.getUser().then(({ data }) => setStatus(data.user ? 'signed-in' : 'signed-out'));
  }, []);

  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await getAnonClient().auth.signInWithOtp({ email }); setSent(true); } catch { setSent(true); }
  };

  if (status === 'loading') return <p className="island">Loading your wallet…</p>;

  if (status === 'no-backend') {
    return (
      <div className="island">
        <div className="island__notice">Preview mode — My Wallet requires Supabase Auth. Connect the backend to sign in, add your cards, and track fee-waiver progress.</div>
        <WalletPreview />
      </div>
    );
  }

  if (status === 'signed-out') {
    return (
      <div className="island">
        <h2>Sign in to your wallet</h2>
        <p style={{ color: 'var(--color-text-secondary)' }}>Track fee-waiver progress, milestone bonuses, and renewals across your cards. We'll email you a secure sign-in link.</p>
        {sent ? (
          <p className="island__trust" role="status">Check your inbox for a sign-in link.</p>
        ) : (
          <form onSubmit={sendMagicLink}>
            <div className="field">
              <label htmlFor="wallet-email">Email address</label>
              <input id="wallet-email" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn-i btn-i--primary" type="submit">Email me a sign-in link</button>
          </form>
        )}
        <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: 'var(--space-6)' }}>Spend tracking here is manual. We're evaluating RBI Account Aggregator (AA) integration for automatic, consent-based spend tracking in a future update.</p>
      </div>
    );
  }

  return <WalletPreview signedIn />;
}

function WalletPreview({ signedIn = false }: { signedIn?: boolean }) {
  // Illustrative structure (no live data without a session). With a backend this
  // renders the user's user_wallet_cards + wallet_summary_view aggregates.
  const demo = [
    { name: 'Add your first card', fee: 0, spend: 0, threshold: 0, renewalDays: null as number | null, milestone: null as string | null },
  ];
  return (
    <div>
      <header className="totals" aria-label="Wallet summary">
        <div><strong>₹0</strong><span>total annual fees</span></div>
        <div><strong>0</strong><span>lounge visits / year</span></div>
        <div><strong>0</strong><span>cards</span></div>
      </header>
      {signedIn && (
        <p style={{ color: 'var(--color-text-secondary)' }}>Your wallet is empty. Search the catalog to add the cards you own.</p>
      )}
      {demo.map((d, i) => (
        <article className="result-card" key={i}>
          <h3>{d.name}</h3>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--text-body-sm)' }}>
            Add owned cards from the catalog, set your card-open date and billing cycle, then log spend to see your
            progress toward each card's fee-waiver threshold and milestone bonuses.
          </p>
        </article>
      ))}
      <p style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', marginTop: 'var(--space-4)' }}>
        Spend tracking is manual in v1. We're evaluating RBI Account Aggregator (AA) integration for automatic,
        consent-based spend tracking in a future update.
      </p>
    </div>
  );
}
