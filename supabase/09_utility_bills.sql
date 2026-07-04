-- ============================================================================
-- NEW FEATURE: Utility bills (Electricity, etc.) — owner creates a bill for
-- a tenant, tenant sees it as "Amount Due" and can pay/claim, owner approves.
--
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create table if not exists bills (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  bill_type text not null default 'Electricity',
  for_month text not null,
  amount numeric(10,2) not null,
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'pending_approval', 'paid')),
  paid_date date,
  created_at timestamptz default now()
);

alter table bills enable row level security;

create policy "Owners manage bills" on bills for all
  using (owns_property(property_id) or get_my_role() = 'super_admin');

create policy "Tenants view own bills" on bills for select
  using (tenant_id in (select id from tenants where auth_user_id = auth.uid()));

-- Tenants can never UPDATE the bills row directly (would let them tamper
-- with the amount). Instead they call this RPC, which only ever flips
-- status pending -> pending_approval for a bill that's actually theirs.
create or replace function claim_bill_paid(p_bill_id uuid) returns void
language plpgsql security definer as $$
begin
  update bills set status = 'pending_approval'
  where id = p_bill_id
    and status = 'pending'
    and tenant_id in (select id from tenants where auth_user_id = auth.uid());
end;
$$;

grant execute on function claim_bill_paid(uuid) to authenticated;

create index if not exists idx_bills_property on bills(property_id);
create index if not exists idx_bills_tenant on bills(tenant_id);

-- ============================================================================
-- DONE
-- ============================================================================
