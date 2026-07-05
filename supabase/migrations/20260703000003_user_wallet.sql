-- =====================================================================
-- 20260703000003_user_wallet.sql
-- User / wallet tables (§4.3), auth.users -> profiles trigger (§10),
-- growth/ops tables (§4.4). RLS: owner-scoped where user_id = auth.uid().
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles  (id references auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  mobile_number text,
  email         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- §10: create the profiles row on auth.users insert via a trigger (avoids the
-- authenticated-but-no-profile race). SECURITY DEFINER so it can write to
-- public.profiles regardless of the inserting role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, mobile_number, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.phone, new.raw_user_meta_data ->> 'mobile_number'),
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- user_wallet_cards
-- ---------------------------------------------------------------------
create table if not exists public.user_wallet_cards (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  card_id             uuid not null references public.cards(id) on delete restrict,
  card_opened_date    date,
  billing_cycle_day   int check (billing_cycle_day between 1 and 31),
  current_cycle_spend numeric not null default 0,
  last_spend_update   timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_wallet_user on public.user_wallet_cards(user_id);
create index if not exists idx_wallet_card on public.user_wallet_cards(card_id);

-- ---------------------------------------------------------------------
-- wallet_spend_log
-- ---------------------------------------------------------------------
create table if not exists public.wallet_spend_log (
  id             uuid primary key default gen_random_uuid(),
  wallet_card_id uuid not null references public.user_wallet_cards(id) on delete cascade,
  amount         numeric not null,
  logged_at      timestamptz not null default now(),
  note           text
);
create index if not exists idx_spendlog_wallet on public.wallet_spend_log(wallet_card_id);

-- ---------------------------------------------------------------------
-- recommendation_sessions / combo_optimizer_sessions (analytics)
-- ---------------------------------------------------------------------
create table if not exists public.recommendation_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  answers    jsonb not null default '{}'::jsonb,
  results    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.combo_optimizer_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete set null,
  answers    jsonb not null default '{}'::jsonb,
  results    jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- newsletter_subscribers
-- ---------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  subscribed_at timestamptz not null default now(),
  confirmed     boolean not null default false,
  source        text
);

-- ---------------------------------------------------------------------
-- card_click_events (affiliate attribution)
-- ---------------------------------------------------------------------
create table if not exists public.card_click_events (
  id              uuid primary key default gen_random_uuid(),
  card_id         uuid references public.cards(id) on delete set null,
  anon_session_id text,
  user_id         uuid references public.profiles(id) on delete set null,
  clicked_at      timestamptz not null default now(),
  destination_url text,
  referrer_page   text
);
create index if not exists idx_click_card on public.card_click_events(card_id);

-- ---------------------------------------------------------------------
-- reminders_sent (dedupe guard for §9.5)
-- ---------------------------------------------------------------------
create table if not exists public.reminders_sent (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  wallet_card_id uuid not null references public.user_wallet_cards(id) on delete cascade,
  reminder_type  text not null,
  sent_at        timestamptz not null default now()
);
create index if not exists idx_reminders_lookup on public.reminders_sent(wallet_card_id, reminder_type, sent_at desc);

-- =====================================================================
-- RLS (§5)
-- =====================================================================
alter table public.profiles                enable row level security;
alter table public.user_wallet_cards       enable row level security;
alter table public.wallet_spend_log        enable row level security;
alter table public.recommendation_sessions enable row level security;
alter table public.combo_optimizer_sessions enable row level security;
alter table public.newsletter_subscribers  enable row level security;
alter table public.card_click_events       enable row level security;
alter table public.reminders_sent          enable row level security;

-- profiles: owner-scoped -----------------------------------------------
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_delete_own on public.profiles
  for delete to authenticated using (id = auth.uid());
create policy profiles_service_all on public.profiles
  for all to service_role using (true) with check (true);

-- user_wallet_cards: owner-scoped --------------------------------------
create policy wallet_select_own on public.user_wallet_cards
  for select to authenticated using (user_id = auth.uid());
create policy wallet_insert_own on public.user_wallet_cards
  for insert to authenticated with check (user_id = auth.uid());
create policy wallet_update_own on public.user_wallet_cards
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wallet_delete_own on public.user_wallet_cards
  for delete to authenticated using (user_id = auth.uid());
create policy wallet_service_all on public.user_wallet_cards
  for all to service_role using (true) with check (true);

-- wallet_spend_log: owner-scoped via parent wallet card ----------------
create policy spendlog_select_own on public.wallet_spend_log
  for select to authenticated using (
    exists (select 1 from public.user_wallet_cards w
            where w.id = wallet_spend_log.wallet_card_id and w.user_id = auth.uid()));
create policy spendlog_insert_own on public.wallet_spend_log
  for insert to authenticated with check (
    exists (select 1 from public.user_wallet_cards w
            where w.id = wallet_spend_log.wallet_card_id and w.user_id = auth.uid()));
create policy spendlog_update_own on public.wallet_spend_log
  for update to authenticated using (
    exists (select 1 from public.user_wallet_cards w
            where w.id = wallet_spend_log.wallet_card_id and w.user_id = auth.uid()))
    with check (
    exists (select 1 from public.user_wallet_cards w
            where w.id = wallet_spend_log.wallet_card_id and w.user_id = auth.uid()));
create policy spendlog_delete_own on public.wallet_spend_log
  for delete to authenticated using (
    exists (select 1 from public.user_wallet_cards w
            where w.id = wallet_spend_log.wallet_card_id and w.user_id = auth.uid()));
create policy spendlog_service_all on public.wallet_spend_log
  for all to service_role using (true) with check (true);

-- recommendation_sessions: anon insert (user_id null), auth insert+select own
create policy recsess_anon_insert on public.recommendation_sessions
  for insert to anon with check (user_id is null);
create policy recsess_auth_insert on public.recommendation_sessions
  for insert to authenticated with check (user_id = auth.uid() or user_id is null);
create policy recsess_auth_select_own on public.recommendation_sessions
  for select to authenticated using (user_id = auth.uid());
create policy recsess_service_all on public.recommendation_sessions
  for all to service_role using (true) with check (true);

-- combo_optimizer_sessions: same shape
create policy combosess_anon_insert on public.combo_optimizer_sessions
  for insert to anon with check (user_id is null);
create policy combosess_auth_insert on public.combo_optimizer_sessions
  for insert to authenticated with check (user_id = auth.uid() or user_id is null);
create policy combosess_auth_select_own on public.combo_optimizer_sessions
  for select to authenticated using (user_id = auth.uid());
create policy combosess_service_all on public.combo_optimizer_sessions
  for all to service_role using (true) with check (true);

-- newsletter_subscribers: insert only for anon/authenticated (protect emails)
create policy newsletter_anon_insert on public.newsletter_subscribers
  for insert to anon with check (true);
create policy newsletter_auth_insert on public.newsletter_subscribers
  for insert to authenticated with check (true);
create policy newsletter_service_all on public.newsletter_subscribers
  for all to service_role using (true) with check (true);

-- card_click_events: insert only for anon/authenticated
create policy click_anon_insert on public.card_click_events
  for insert to anon with check (true);
create policy click_auth_insert on public.card_click_events
  for insert to authenticated with check (true);
create policy click_service_all on public.card_click_events
  for all to service_role using (true) with check (true);

-- reminders_sent: authenticated select own, service full
create policy reminders_select_own on public.reminders_sent
  for select to authenticated using (user_id = auth.uid());
create policy reminders_service_all on public.reminders_sent
  for all to service_role using (true) with check (true);
