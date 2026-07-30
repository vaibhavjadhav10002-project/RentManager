-- ============================================================================
-- NEW FEATURE: Electricity Bills
-- Owner raises a bill for a tenant (amount + due date + month). Tenant sees
-- it as an "Amount Due" item, can pay via UPI and self-report, owner
-- confirms — same approval pattern already used for rent payments.
--
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

create type bill_status as enum ('unpaid', 'pending_approval', 'paid');

create table if not exists electricity_bills (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references properties(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  for_month text not null,
  amount numeric(10,2) not null,
  due_date date,
  status bill_status not null default 'unpaid',
  method payment_method,
  tenant_note text,
  created_at timestamptz default now(),
  paid_at timestamptz
);

create index if not exists idx_electricity_bills_property on electricity_bills(property_id);
create index if not exists idx_electricity_bills_tenant on electricity_bills(tenant_id);

alter table electricity_bills enable row level security;

create policy "View bills of own properties or self" on electricity_bills for select
  using (
    get_my_role() = 'super_admin' or owns_property(property_id)
    or tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );

create policy "Owners raise bills" on electricity_bills for insert
  with check (owns_property(property_id) or get_my_role() = 'super_admin');

create policy "Owners update bills; tenants can self-report payment" on electricity_bills for update
  using (
    owns_property(property_id) or get_my_role() = 'super_admin'
    or tenant_id in (select id from tenants where auth_user_id = auth.uid())
  );

create policy "Owners delete bills" on electricity_bills for delete
  using (owns_property(property_id) or get_my_role() = 'super_admin');

-- Prevent a tenant from directly marking their own bill 'paid' or editing
-- the amount/due date — they may only move it to 'pending_approval' (i.e.
-- "I've paid, please confirm"), same pattern as the rent approval flow.
create or replace function guard_electricity_bill_update() returns trigger as $$
begin
  if not (owns_property(new.property_id) or get_my_role() = 'super_admin') then
    if new.amount <> old.amount or new.due_date is distinct from old.due_date
       or new.for_month <> old.for_month or new.property_id <> old.property_id
       or new.tenant_id <> old.tenant_id then
      raise exception 'Not allowed to change bill details';
    end if;
    if new.status <> old.status and new.status <> 'pending_approval' then
      raise exception 'Tenants can only mark a bill as pending approval';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_guard_electricity_bill_update on electricity_bills;
create trigger trg_guard_electricity_bill_update
  before update on electricity_bills
  for each row execute function guard_electricity_bill_update();

-- ============================================================================
-- DONE
-- ============================================================================
