-- ============================================================================
-- TENANT DATE OF BIRTH + CO-TENANT BIRTHDAY WIDGET
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

alter table tenants add column if not exists date_of_birth date;

-- Privacy-safe: returns only name + DOB (nothing else) for active,
-- logged-in co-tenants at the same property.
create or replace function get_cotenant_birthdays(p_property_id uuid)
returns table (name text, date_of_birth date) as $$
  select t.name, t.date_of_birth
  from tenants t
  where t.property_id = p_property_id
    and t.status = 'active'
    and t.date_of_birth is not null
    and tenant_belongs_to_property(p_property_id)
    and t.auth_user_id is not null;
$$ language sql security definer;

grant execute on function get_cotenant_birthdays(uuid) to authenticated;

-- ============================================================================
-- DONE
-- ============================================================================
