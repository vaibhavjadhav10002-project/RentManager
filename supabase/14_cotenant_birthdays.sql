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
-- ROOM PHOTOS
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('room-photos', 'room-photos', true)
on conflict (id) do nothing;

drop policy if exists "Owners upload room photos" on storage.objects;
create policy "Owners upload room photos" on storage.objects for insert
  with check (bucket_id = 'room-photos' and auth.role() = 'authenticated');

drop policy if exists "Public can view room photos" on storage.objects;
create policy "Public can view room photos" on storage.objects for select
  using (bucket_id = 'room-photos');

drop policy if exists "Owners delete room photos" on storage.objects;
create policy "Owners delete room photos" on storage.objects for delete
  using (bucket_id = 'room-photos' and auth.role() = 'authenticated');

-- ============================================================================
-- DONE
-- ============================================================================
