-- ============================================================================
-- SETUP: Real owner account + 8 properties + rooms 100-115 in each
--
-- Password for this account: Pass@123
-- (they'll be prompted to change it on first login automatically)
--
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- ============================================================================

-- ---- 1. Create the owner login ----
do $$
declare
  new_user_id uuid := gen_random_uuid();
begin
  -- Skip if this email already has an account
  if exists (select 1 from auth.users where email = 'pgchatrapati@gmail.com') then
    raise notice 'pgchatrapati@gmail.com already exists — skipping user creation';
  else
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      new_user_id, 'authenticated', 'authenticated',
      'pgchatrapati@gmail.com',
      crypt('Pass@123', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"PG Chatrapati","role":"pg_owner"}',
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), new_user_id, new_user_id::text,
      jsonb_build_object('sub', new_user_id::text, 'email', 'pgchatrapati@gmail.com', 'email_verified', true),
      'email', now(), now(), now()
    );
  end if;
end $$;

-- ---- 2. Create the 8 properties + rooms 100-115 in each ----
do $$
declare
  v_owner_id uuid;
  prop_id uuid;
  prop_name text;
  room_num int;
  prop_names text[] := array['Sunshine', 'Crystal', 'Haridarshan', 'Shivneri', 'Torna', 'Rajgad', 'Heritage', 'Gotri'];
begin
  select id into v_owner_id from profiles where email = 'pgchatrapati@gmail.com';

  if v_owner_id is null then
    raise exception 'Owner profile not found — check that the user was created above';
  end if;

  foreach prop_name in array prop_names loop
    -- Skip if a property with this exact name already exists for this owner
    if exists (select 1 from properties where owner_id = v_owner_id and name = prop_name) then
      raise notice 'Property "%" already exists — skipping', prop_name;
      continue;
    end if;

    insert into properties (owner_id, name, qr_slug)
    values (
      v_owner_id,
      prop_name,
      lower(regexp_replace(prop_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 5)
    )
    returning id into prop_id;

    for room_num in 100..115 loop
      insert into rooms (property_id, room_number, floor, sharing_type, total_beds, monthly_rent)
      values (prop_id, room_num::text, 1, '2 Sharing', 2, 8000)
      on conflict (property_id, room_number) do nothing;
    end loop;
  end loop;
end $$;

-- ---- 3. Verify ----
select p.name as property, count(r.id) as room_count
from properties p
left join rooms r on r.property_id = p.id
where p.owner_id = (select id from profiles where email = 'pgchatrapati@gmail.com')
group by p.name
order by p.name;

-- ============================================================================
-- DONE
-- Login: pgchatrapati@gmail.com / Pass@123 (will be asked to change on first login)
-- Room numbers, sharing type, rent (₹8000 default) can all be edited from the
-- Rooms page in the app. Extra rooms can be deleted from there too.
-- ============================================================================
