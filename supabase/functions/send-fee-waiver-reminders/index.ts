/*
 * send-fee-waiver-reminders (scheduled, daily) — §9.5.
 * For each user_wallet_cards row with card_opened_date/billing_cycle_day set,
 * compute days remaining in the current fee-waiver measurement period and the
 * spend gap against cards.annual_fee_waiver_spend_amount. If within a threshold
 * window (≤30 days, gap > 0) and no matching reminders_sent row in the last 14
 * days, send a Resend email and log it (dedupe guard).
 *
 * Schedule via pg_cron / Supabase Cron (see supabase/README.md).
 */
import { getServiceClient, handleOptions, json } from '../_shared/client.ts';

const DAYS_WINDOW = 30;
const DEDUPE_DAYS = 14;
const REMINDER_TYPE = 'fee_waiver';

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const supa = getServiceClient();
  const now = new Date();

  const { data: walletCards } = await supa
    .from('user_wallet_cards')
    .select(
      'id,user_id,card_id,card_opened_date,billing_cycle_day,current_cycle_spend,' +
        'cards(name,annual_fee_amount,annual_fee_waiver_spend_amount),' +
        'profiles(email,full_name)',
    )
    .not('card_opened_date', 'is', null);

  let sent = 0; let skipped = 0;

  for (const wc of (walletCards ?? []) as any[]) {
    const card = wc.cards;
    const waiver = card?.annual_fee_waiver_spend_amount;
    const fee = card?.annual_fee_amount ?? 0;
    if (!waiver || waiver <= 0 || fee <= 0) { skipped++; continue; } // no waiver to chase / lifetime-free

    // Anniversary-year measurement period from card_opened_date.
    const opened = new Date(wc.card_opened_date);
    const periodEnd = nextAnniversary(opened, now);
    const daysRemaining = Math.ceil((periodEnd.getTime() - now.getTime()) / 86_400_000);
    if (daysRemaining > DAYS_WINDOW || daysRemaining < 0) { skipped++; continue; }

    const spend = Number(wc.current_cycle_spend ?? 0);
    const gap = waiver - spend;
    if (gap <= 0) { skipped++; continue; } // already achieved

    // Dedupe guard.
    const cutoff = new Date(now.getTime() - DEDUPE_DAYS * 86_400_000).toISOString();
    const { data: recent } = await supa
      .from('reminders_sent')
      .select('id')
      .eq('wallet_card_id', wc.id)
      .eq('reminder_type', REMINDER_TYPE)
      .gte('sent_at', cutoff)
      .limit(1);
    if (recent && recent.length) { skipped++; continue; }

    const email = wc.profiles?.email;
    if (!email) { skipped++; continue; }

    const ok = await sendEmail(email, wc.profiles?.full_name ?? null, card.name, gap, daysRemaining, fee);
    if (ok) {
      await supa.from('reminders_sent').insert({
        user_id: wc.user_id, wallet_card_id: wc.id, reminder_type: REMINDER_TYPE,
      });
      sent++;
    } else {
      skipped++;
    }
  }

  return json({ sent, skipped });
});

/** Next anniversary of `opened` on/after `from`. */
function nextAnniversary(opened: Date, from: Date): Date {
  const d = new Date(from.getFullYear(), opened.getMonth(), opened.getDate());
  if (d.getTime() < from.getTime()) d.setFullYear(d.getFullYear() + 1);
  return d;
}

async function sendEmail(
  to: string, name: string | null, cardName: string, gap: number, days: number, fee: number,
): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  const fmt = (n: number) => `₹${new Intl.NumberFormat('en-IN').format(Math.round(n))}`;
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const body = `${greeting}\n\nYou're ${fmt(gap)} away from waiving the ${fmt(fee)} annual fee on your ${cardName}, with about ${days} day(s) left in this fee-waiver period. Spending the remaining amount before then can save you the fee.\n\n— CardCompare.in\n\nThis is a manual-tracking estimate based on the spend you've logged. Reply STOP to opt out of reminders.`;
  if (!key) {
    console.log(`[dry-run:no RESEND_API_KEY] would email ${to}: ${cardName} gap ${fmt(gap)} / ${days}d`);
    return true; // treat as sent in dev so the dedupe/flow can be exercised
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CardCompare.in <reminders@cardcompare.in>',
        to, subject: `You're ${fmt(gap)} from waiving your ${cardName} fee`, text: body,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('Resend failed', e);
    return false;
  }
}
