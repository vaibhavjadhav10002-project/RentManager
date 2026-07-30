-- ============================================================================
-- AUTOMATIC BACKUP (Phase 5.13)
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create table if not exists backup_settings (
  owner_id uuid primary key references profiles(id) on delete cascade,
  enabled boolean not null default false,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  retention_count int not null default 7,
  last_run_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists backup_runs (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'failed')),
  file_path text,
  property_count int,
  record_count int,
  error_message text
);

alter table backup_settings enable row level security;
alter table backup_runs enable row level security;

drop policy if exists "Owners manage own backup settings" on backup_settings;
create policy "Owners manage own backup settings" on backup_settings for all
  using (owner_id = auth.uid());

drop policy if exists "Owners view own backup runs" on backup_runs;
create policy "Owners view own backup runs" on backup_runs for select
  using (owner_id = auth.uid());
-- Inserts/updates to backup_runs are done by the cron job using the service-role
-- key, which bypasses RLS — no client-side write policy is needed or provided.

create index if not exists idx_backup_runs_owner on backup_runs(owner_id, started_at desc);

-- Private bucket — automatic backups contain full tenant/financial data, so unlike
-- notice-attachments this must NOT be public. Files are stored at "{owner_id}/{file}".
insert into storage.buckets (id, name, public)
values ('automatic-backups', 'automatic-backups', false)
on conflict (id) do nothing;

drop policy if exists "Owners read own automatic backups" on storage.objects;
create policy "Owners read own automatic backups" on storage.objects for select
  using (bucket_id = 'automatic-backups' and (storage.foldername(name))[1] = auth.uid()::text);
-- No client-side insert/delete/update policy — only the cron job (service-role key,
-- bypasses RLS) writes to this bucket.

-- ============================================================================
-- DONE
-- ============================================================================
