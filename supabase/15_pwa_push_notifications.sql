-- ============================================================================
-- PWA PUSH NOTIFICATIONS + NOTIFICATION BELL HISTORY
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- One row per device/browser a user has enabled notifications on.
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz default now(),
  unique(user_id, endpoint)
);

alter table push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions" on push_subscriptions;
create policy "Users manage own push subscriptions" on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Every push sent is also logged here so the notification bell has history
-- even for notifications the user missed or the browser blocked.
create table if not exists notification_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  url text,
  read boolean not null default false,
  created_at timestamptz default now()
);

alter table notification_log enable row level security;

drop policy if exists "Users view own notification log" on notification_log;
create policy "Users view own notification log" on notification_log for select
  using (user_id = auth.uid());

drop policy if exists "Users update own notification log" on notification_log;
create policy "Users update own notification log" on notification_log for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Inserts happen from the server (API route) using the service role key,
-- which bypasses RLS entirely — no insert policy needed for that path.
-- This policy additionally allows authenticated users to write their own
-- log entries directly if ever needed client-side.
drop policy if exists "Users insert own notification log" on notification_log;
create policy "Users insert own notification log" on notification_log for insert
  with check (user_id = auth.uid());

create index if not exists idx_push_subs_user on push_subscriptions(user_id);
create index if not exists idx_notif_log_user on notification_log(user_id, created_at desc);

-- ============================================================================
-- DONE
-- ============================================================================
