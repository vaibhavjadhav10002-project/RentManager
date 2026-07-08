-- ============================================================================
-- NOTICE BOARD SYSTEM
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create type notice_category as enum ('General', 'Maintenance', 'Rent', 'Electricity', 'Emergency', 'Event');
create type notice_priority as enum ('Normal', 'Important', 'Urgent');

create table if not exists notices (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  title text not null,
  description text not null,
  category notice_category not null default 'General',
  priority notice_priority not null default 'Normal',
  publish_date date not null default current_date,
  expiry_date date,
  attachment_url text,
  attachment_name text,
  created_by text,
  created_at timestamptz default now()
);

-- Per-tenant read tracking — a notice is "unread" for a tenant until a row
-- exists here for that (notice, tenant) pair.
create table if not exists notice_reads (
  notice_id uuid not null references notices(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, tenant_id)
);

alter table notices enable row level security;
alter table notice_reads enable row level security;

drop policy if exists "Owners manage notices for own properties" on notices;
create policy "Owners manage notices for own properties" on notices for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

drop policy if exists "Tenants view active notices for own property" on notices;
create policy "Tenants view active notices for own property" on notices for select
  using (tenant_belongs_to_property(property_id));

drop policy if exists "Tenants manage own read receipts" on notice_reads;
create policy "Tenants manage own read receipts" on notice_reads for all
  using (tenant_id in (select id from tenants where auth_user_id = auth.uid()))
  with check (tenant_id in (select id from tenants where auth_user_id = auth.uid()));

drop policy if exists "Owners view read receipts for own properties" on notice_reads;
create policy "Owners view read receipts for own properties" on notice_reads for select
  using (
    notice_id in (select id from notices where owns_property(property_id))
    or get_my_role() = 'super_admin'
  );

create index if not exists idx_notices_property on notices(property_id);
create index if not exists idx_notice_reads_tenant on notice_reads(tenant_id);

-- Storage bucket for notice attachments (reuses the same public-bucket pattern
-- already used for tenant Government ID photos)
insert into storage.buckets (id, name, public)
values ('notice-attachments', 'notice-attachments', true)
on conflict (id) do nothing;

drop policy if exists "Owners upload notice attachments" on storage.objects;
create policy "Owners upload notice attachments" on storage.objects for insert
  with check (bucket_id = 'notice-attachments' and auth.role() = 'authenticated');

drop policy if exists "Public can view notice attachments" on storage.objects;
create policy "Public can view notice attachments" on storage.objects for select
  using (bucket_id = 'notice-attachments');

-- ============================================================================
-- DONE
-- ============================================================================
