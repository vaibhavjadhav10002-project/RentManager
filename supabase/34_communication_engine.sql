-- ============================================================================
-- COMMUNICATION ENGINE (Phase 9.1)
-- Renumbered from 29_communication_engine.sql (source patch) to 34_ during
-- merge, since Phase 8 already used 29-33. Content unchanged.
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
--
-- Reusable infrastructure behind the Owner "Inbox". Does not touch any
-- existing table (tenants, properties, payments, push_subscriptions, etc.)
-- and does not replace the existing push-notification system in any way —
-- communication_logs simply records a history entry alongside whatever
-- channel (push notification today; WhatsApp click-to-chat, SMS, email in
-- future phases) actually delivered something.
-- ============================================================================

create type communication_channel as enum ('whatsapp', 'push', 'sms', 'email');
create type communication_status as enum ('pending', 'sent', 'failed', 'cancelled');
create type template_category as enum ('rent_reminder', 'due_today', 'overdue', 'welcome', 'notice', 'general', 'custom');

-- Message Templates — reusable, variable-driven text. A handful of system
-- defaults are seeded per property on first use (see queries.ts), but
-- owners can add/edit/delete their own on top of those.
create table if not exists message_templates (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  name text not null,
  category template_category not null default 'general',
  channel communication_channel not null default 'whatsapp',
  body text not null,
  is_system_default boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Communication Queue — a pending/sent/failed record for any message that
-- was generated (whether or not it's been dispatched yet). Phase 9.1 only
-- creates and displays queue rows; Phase 9.2 (Manual Send) is what actually
-- moves a row from 'pending' to 'sent' by opening the wa.me link. Phase 9.3
-- (Reminder Engine / Retry Queue) is what will populate this automatically
-- on a schedule — this table is designed for that from the start so 9.3
-- doesn't need a schema change.
create table if not exists communication_queue (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete cascade,
  template_id uuid references message_templates(id) on delete set null,
  channel communication_channel not null default 'whatsapp',
  rendered_message text not null,
  status communication_status not null default 'pending',
  scheduled_for timestamptz default now(),
  attempt_count int not null default 0,
  last_error text,
  created_at timestamptz default now(),
  sent_at timestamptz
);

-- Communication Logs — permanent history, separate from the queue (a queue
-- row can be deleted/cleaned up once resolved; logs are kept). This is what
-- powers the Inbox "History" tab. Distinct from the Notification Bell,
-- which is real-time alerts — this is the durable record of what was
-- actually communicated, on any channel.
create table if not exists communication_logs (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid references tenants(id) on delete set null,
  template_id uuid references message_templates(id) on delete set null,
  channel communication_channel not null,
  rendered_message text not null,
  status communication_status not null default 'sent',
  sent_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Communication Settings — one row per property. Owner-level preferences
-- for the engine (default reminder lead time, which channels are enabled).
-- Deliberately minimal for 9.1; 9.3 (Reminder Engine) will read
-- default_reminder_days from here rather than hardcoding it.
create table if not exists communication_settings (
  property_id uuid primary key references properties(id) on delete cascade,
  whatsapp_enabled boolean not null default true,
  push_enabled boolean not null default true,
  default_reminder_days int not null default 3,
  updated_at timestamptz default now()
);

alter table message_templates enable row level security;
alter table communication_queue enable row level security;
alter table communication_logs enable row level security;
alter table communication_settings enable row level security;

drop policy if exists "Owners manage templates for own properties" on message_templates;
create policy "Owners manage templates for own properties" on message_templates for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

drop policy if exists "Owners manage queue for own properties" on communication_queue;
create policy "Owners manage queue for own properties" on communication_queue for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

drop policy if exists "Owners manage logs for own properties" on communication_logs;
create policy "Owners manage logs for own properties" on communication_logs for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

drop policy if exists "Owners manage settings for own properties" on communication_settings;
create policy "Owners manage settings for own properties" on communication_settings for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

create index if not exists idx_message_templates_property on message_templates(property_id);
create index if not exists idx_communication_queue_property on communication_queue(property_id);
create index if not exists idx_communication_queue_status on communication_queue(status);
create index if not exists idx_communication_queue_tenant on communication_queue(tenant_id);
create index if not exists idx_communication_logs_property on communication_logs(property_id);
create index if not exists idx_communication_logs_tenant on communication_logs(tenant_id);

-- ============================================================================
-- DONE
-- ============================================================================
