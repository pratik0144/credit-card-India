/*
 * detect-card-changes (scheduled, weekly) — §9.4.
 * For each card, compare its two most recent card_snapshots. Diff a fixed
 * watch-list of fields; for every material change insert a card_change_log row
 * with a human-readable summary. Then trigger send-change-alerts for any card
 * that sits in someone's wallet.
 *
 * Schedule via pg_cron / Supabase Cron (see supabase/README.md). Also callable
 * ad-hoc via POST for testing.
 */
import { getServiceClient, handleOptions, json } from '../_shared/client.ts';

type ChangeType =
  | 'fee_increase' | 'fee_decrease' | 'reward_devaluation' | 'reward_improvement'
  | 'benefit_added' | 'benefit_removed' | 'eligibility_change' | 'other';

interface WatchField {
  key: string;
  label: string;
  kind: 'money' | 'pct' | 'int' | 'text';
  /** direction semantics for numeric fields */
  higherIs?: 'worse' | 'better';
}

// Watch-list of fields on the snapshot JSON (§9.4).
const WATCH: WatchField[] = [
  { key: 'joining_fee_amount', label: 'Joining fee', kind: 'money', higherIs: 'worse' },
  { key: 'annual_fee_amount', label: 'Annual fee', kind: 'money', higherIs: 'worse' },
  { key: 'annual_fee_waiver_spend_amount', label: 'Fee-waiver spend threshold', kind: 'money', higherIs: 'worse' },
  { key: 'forex_markup_pct', label: 'Forex markup', kind: 'pct', higherIs: 'worse' },
  { key: 'reward_rate_general_text', label: 'General reward rate', kind: 'text' },
  { key: 'cibil_min', label: 'Minimum CIBIL', kind: 'int', higherIs: 'worse' },
  { key: 'lounge_domestic_visits_per_year', label: 'Domestic lounge visits', kind: 'int', higherIs: 'better' },
  { key: 'lounge_intl_visits_per_year', label: 'International lounge visits', kind: 'int', higherIs: 'better' },
];

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const supa = getServiceClient();
  const { data: cards } = await supa.from('cards').select('id,name').eq('is_active', true);
  let inserted = 0;
  const affectedCardIds: string[] = [];

  for (const card of (cards ?? []) as { id: string; name: string }[]) {
    const { data: snaps } = await supa
      .from('card_snapshots')
      .select('snapshot, snapshotted_at')
      .eq('card_id', card.id)
      .order('snapshotted_at', { ascending: false })
      .limit(2);
    if (!snaps || snaps.length < 2) continue;
    const [curr, prev] = snaps as { snapshot: Record<string, unknown> }[];

    for (const f of WATCH) {
      const before = prev.snapshot[f.key];
      const after = curr.snapshot[f.key];
      if (before == null && after == null) continue;
      if (String(before ?? '') === String(after ?? '')) continue;

      const { change_type, summary } = classify(f, before, after);
      const { error } = await supa.from('card_change_log').insert({
        card_id: card.id,
        change_type,
        field_name: f.key,
        old_value: before == null ? null : String(before),
        new_value: after == null ? null : String(after),
        summary,
        source_note: 'Auto-detected from import snapshot diff.',
      });
      if (!error) { inserted++; if (!affectedCardIds.includes(card.id)) affectedCardIds.push(card.id); }
    }
  }

  // Notify wallets holding an affected card (best-effort).
  if (affectedCardIds.length) {
    const { data: wallets } = await supa
      .from('user_wallet_cards')
      .select('card_id')
      .in('card_id', affectedCardIds);
    const heldCardIds = [...new Set((wallets ?? []).map((w: any) => w.card_id))];
    if (heldCardIds.length) {
      // Fire send-change-alerts (implemented alongside §9.4 — invoked here).
      const base = Deno.env.get('SUPABASE_URL');
      fetch(`${base}/functions/v1/send-change-alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ card_ids: heldCardIds }),
      }).catch(() => {});
    }
  }

  return json({ inserted, affected_cards: affectedCardIds.length });
});

function fmtMoney(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `₹${new Intl.NumberFormat('en-IN').format(n)}` : String(v ?? '—');
}

function classify(f: WatchField, before: unknown, after: unknown): { change_type: ChangeType; summary: string } {
  const label = f.label;
  if (f.kind === 'text') {
    return { change_type: 'other', summary: `${label} changed from "${before ?? '—'}" to "${after ?? '—'}".` };
  }
  const b = Number(before) || 0;
  const a = Number(after) || 0;
  const disp = f.kind === 'money' ? { b: fmtMoney(before), a: fmtMoney(after) }
    : f.kind === 'pct' ? { b: `${before ?? '—'}%`, a: `${after ?? '—'}%` }
    : { b: String(before ?? '—'), a: String(after ?? '—') };

  const increased = a > b;
  let change_type: ChangeType = 'other';
  if (f.key.includes('fee') && f.key !== 'annual_fee_waiver_spend_amount') {
    change_type = increased ? 'fee_increase' : 'fee_decrease';
  } else if (f.key === 'annual_fee_waiver_spend_amount') {
    change_type = increased ? 'reward_devaluation' : 'reward_improvement';
  } else if (f.key.includes('lounge')) {
    change_type = increased ? 'benefit_added' : 'benefit_removed';
  } else if (f.key === 'cibil_min') {
    change_type = 'eligibility_change';
  } else if (f.key === 'forex_markup_pct') {
    change_type = increased ? 'fee_increase' : 'fee_decrease';
  }
  const verb = increased ? 'increased' : 'decreased';
  return { change_type, summary: `${label} ${verb} from ${disp.b} to ${disp.a}.` };
}
