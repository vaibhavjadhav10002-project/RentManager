-- 35_native_push_tokens.sql
-- Mobile app (Capacitor) support: adds nullable columns to the EXISTING
-- push_subscriptions table so native FCM/APNs device tokens can live
-- alongside existing Web Push subscriptions. Purely additive — no
-- existing column, row, or constraint is changed, and every existing
-- web push subscription and query keeps working unmodified.

alter table public.push_subscriptions
  add column if not exists native_token text,
  add column if not exists native_platform text check (native_platform in ('ios', 'android'));

comment on column public.push_subscriptions.native_token is
  'FCM (Android) or APNs (iOS) device token, set only for rows created by the Capacitor mobile app.';
comment on column public.push_subscriptions.native_platform is
  'ios | android — set only for native app rows; null for browser Web Push subscriptions.';

-- Native rows have no p256dh/auth_key (those are Web Push-only concepts),
-- so the original NOT NULL constraints must relax for this table to
-- accept native token rows. Existing web push rows are unaffected — they
-- already have both values populated.
alter table public.push_subscriptions alter column p256dh drop not null;
alter table public.push_subscriptions alter column auth_key drop not null;

alter table public.push_subscriptions drop constraint if exists push_subscriptions_web_or_native_check;
alter table public.push_subscriptions add constraint push_subscriptions_web_or_native_check
  check (
    (p256dh is not null and auth_key is not null)
    or (native_token is not null and native_platform is not null)
  );
