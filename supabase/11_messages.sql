-- ============================================================================
-- TENANT ↔ OWNER MESSAGING
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  property_id uuid not null references properties(id) on delete cascade,
  sender text not null check (sender in ('tenant', 'owner')),
  body text not null,
  read_by_tenant boolean not null default false,
  read_by_owner boolean not null default false,
  created_at timestamptz default now()
);

alter table messages enable row level security;

drop policy if exists "Owners manage messages for own properties" on messages;
create policy "Owners manage messages for own properties" on messages for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

drop policy if exists "Tenants view own messages" on messages;
create policy "Tenants view own messages" on messages for select
  using (tenant_id in (select id from tenants where auth_user_id = auth.uid()));

drop policy if exists "Tenants send own messages" on messages;
create policy "Tenants send own messages" on messages for insert
  with check (
    sender = 'tenant'
    and tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );

drop policy if exists "Tenants mark own messages read" on messages;
create policy "Tenants mark own messages read" on messages for update
  using (tenant_id in (select id from tenants where auth_user_id = auth.uid()))
  with check (tenant_id in (select id from tenants where auth_user_id = auth.uid()));

create index if not exists idx_messages_tenant on messages(tenant_id);
create index if not exists idx_messages_property on messages(property_id);

-- ============================================================================
-- DONE
-- ============================================================================
