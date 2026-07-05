/*
 * send-change-alerts (POST, internal) — invoked by detect-card-changes (§9.4)
 * when a newly-logged card change affects a card held in someone's wallet.
 * Emails each affected wallet owner a summary of the most recent change(s) for
 * that card via Resend. Dedupe by (user, wallet_card, 'change_alert') in the
 * last 14 days to avoid spamming on re-runs.
 */
import { getServiceClient, handleOptions, json } from '../_shared/client.ts';

const DEDUPE_DAYS = 14;
const REMINDER_TYPE = 'change_alert';

interface Payload { card_ids: string[]; }

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let payload: Payload;
  try { payload = await req.json(); } catch { return json({ error: 'invalid JSON body' }, 400); }
  const cardIds = payload.card_ids ?? [];
  if (cardIds.length === 0) return json({ sent: 0 });

  const supa = getServiceClient();
  const now = new Date();
  const cutoff = new Date(now.getTime() - DEDUPE_DAYS * 86_400_000).toISOString();

  // Latest change summary per affected card.
  const summaryByCard = new Map<string, { name: string; summary: string }>();
  for (const cardId of cardIds) {
    const { data } = await supa
      .from('card_change_log')
      .select('summary, cards(name)')
      .eq('card_id', cardId)
      .order('detected_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) summaryByCard.set(cardId, { name: (data as any).cards?.name ?? 'your card', summary: (data as any).summary });
  }

  const { data: wallets } = await supa
    .from('user_wallet_cards')
    .select('id,user_id,card_id,profiles(email,full_name)')
    .in('card_id', cardIds);

  let sent = 0;
  for (const w of (wallets ?? []) as any[]) {
    const info = summaryByCard.get(w.card_id);
    const email = w.profiles?.email;
    if (!info || !email) continue;

    const { data: recent } = await supa
      .from('reminders_sent')
      .select('id').eq('wallet_card_id', w.id).eq('reminder_type', REMINDER_TYPE)
      .gte('sent_at', cutoff).limit(1);
    if (recent && recent.length) continue;

    const ok = await sendEmail(email, w.profiles?.full_name ?? null, info.name, info.summary);
    if (ok) {
      await supa.from('reminders_sent').insert({ user_id: w.user_id, wallet_card_id: w.id, reminder_type: REMINDER_TYPE });
      sent++;
    }
  }
  return json({ sent });
});

async function sendEmail(to: string, name: string | null, cardName: string, summary: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY');
  const greeting = name ? `Hi ${name},` : 'Hi,';
  const body = `${greeting}\n\nA card in your wallet changed:\n\n${cardName}: ${summary}\n\nReview the update on CardCompare.in to see if it affects you.\n\n— CardCompare.in\n\nReply STOP to opt out of change alerts.`;
  if (!key) {
    console.log(`[dry-run:no RESEND_API_KEY] would alert ${to}: ${cardName} — ${summary}`);
    return true;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CardCompare.in <alerts@cardcompare.in>',
        to, subject: `Update to your ${cardName}`, text: body,
      }),
    });
    return res.ok;
  } catch { return false; }
}
