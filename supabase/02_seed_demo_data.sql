-- ============================================================================
-- SEED DEMO DATA — run this AFTER 01_schema_reset.sql
-- IMPORTANT: before running this, create the demo2@gmail.com user in
-- Supabase Dashboard → Authentication → Users → Add User
-- (tick "Auto Confirm User"). Same for your super_admin email if not done yet.
-- ============================================================================

-- ---- 0. Backfill profiles for any auth.users that don't have one yet ----
-- (needed because the profile-creation trigger only fires for NEW signups,
--  not for users that already existed in auth.users before the schema reset)
insert into public.profiles (id, full_name, email, role)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', 'New User'), u.email, 'pg_owner'
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

-- ---- 1. Set up the demo owner profile ----
update profiles
set role = 'pg_owner', full_name = 'Demo Owner'
where email = 'demo2@gmail.com';

-- ---- 2. Property ----
insert into properties (owner_id, name, address, city, state, qr_slug, bank_account_name, bank_account_number, bank_ifsc, upi_id)
select id, 'Sunrise PG', '123 MG Road, Kothrud', 'Pune', 'Maharashtra', 'sunrise-pg-demo',
       'Demo Owner', '123456789012', 'HDFC0001234', 'demoowner@upi'
from profiles where email = 'demo2@gmail.com';

-- ---- 3. Rooms ----
insert into rooms (property_id, room_number, floor, sharing_type, total_beds, monthly_rent)
select p.id, r.room_number, r.floor, r.sharing_type, r.total_beds, r.monthly_rent
from properties p
cross join (values
  ('101', 1, '2 Sharing', 2, 8000),
  ('102', 1, '3 Sharing', 3, 6500),
  ('201', 2, '1 Sharing', 1, 12000),
  ('202', 2, '2 Sharing', 2, 8000)
) as r(room_number, floor, sharing_type, total_beds, monthly_rent)
where p.qr_slug = 'sunrise-pg-demo';

-- ---- 4. Collectors ----
insert into collectors (property_id, name)
select p.id, c.name
from properties p
cross join (values ('Owner — Demo Owner'), ('Warden — Ramesh')) as c(name)
where p.qr_slug = 'sunrise-pg-demo';

-- ---- 5. Tenants ----
insert into tenants (property_id, room_id, bed_label, name, phone, email, emergency_contact,
                      joining_date, monthly_rent, deposit_amount, deposit_paid, status, submitted_via)
select p.id,
       (select id from rooms where property_id = p.id and room_number = t.room_number),
       t.bed_label, t.name, t.phone, t.email, t.emergency_contact,
       t.joining_date::date, t.monthly_rent, t.deposit_amount, t.deposit_paid, t.status::tenant_status, 'owner_added'
from properties p
cross join (values
  ('101', 'A', 'Rahul Sharma',  '9876543210', 'rahul@example.com',  '9876500000', '2026-01-05', 8000,  8000, 8000, 'active'),
  ('101', 'B', 'Amit Verma',    '9876543211', 'amit@example.com',   '9876500001', '2026-02-10', 8000,  8000, 8000, 'active'),
  ('102', 'A', 'Suresh Patil',  '9876543212', 'suresh@example.com', '9876500002', '2026-03-01', 6500,  6500, 4000, 'active'),
  ('102', 'B', 'Vikas Rao',     '9876543213', 'vikas@example.com',  '9876500003', '2026-04-15', 6500,  6500, 6500, 'leaving'),
  ('201', 'A', 'Karan Mehta',   '9876543214', 'karan@example.com',  '9876500004', '2026-05-20', 12000, 12000, 12000, 'active'),
  ('202', 'A', 'Pooja Nair',    '9876543215', 'pooja@example.com',  '9876500005', '2026-06-01', 8000,  8000, 4000, 'pending_approval')
) as t(room_number, bed_label, name, phone, email, emergency_contact, joining_date, monthly_rent, deposit_amount, deposit_paid, status)
where p.qr_slug = 'sunrise-pg-demo';

-- ---- 6. Payments (rent history for active tenants) ----
insert into payments (tenant_id, property_id, type, for_month, total_due, amount_received, method, collected_by, approval_status, payment_date)
select tn.id, tn.property_id, 'rent', pay.for_month, pay.total_due, pay.amount_received,
       pay.method::payment_method,
       (select id from collectors where property_id = tn.property_id limit 1),
       pay.approval_status::payment_approval_status, pay.payment_date::date
from tenants tn
join (values
  ('Rahul Sharma', 'May 2026',  8000, 8000, 'upi',  'approved', '2026-05-03'),
  ('Rahul Sharma', 'June 2026', 8000, 8000, 'upi',  'approved', '2026-06-04'),
  ('Amit Verma',   'June 2026', 8000, 8000, 'cash', 'approved', '2026-06-05'),
  ('Suresh Patil', 'June 2026', 6500, 3000, 'upi',  'pending_approval', '2026-06-28'),
  ('Karan Mehta',  'June 2026', 12000, 12000, 'bank_transfer', 'approved', '2026-06-02')
) as pay(name, for_month, total_due, amount_received, method, approval_status, payment_date)
on tn.name = pay.name
where tn.property_id = (select id from properties where qr_slug = 'sunrise-pg-demo');

-- ---- 7. Complaints ----
insert into complaints (property_id, tenant_id, room_id, issue_type, description, priority, status)
select p.id,
       (select id from tenants where property_id = p.id and name = c.tenant_name),
       (select id from rooms where property_id = p.id and room_number = c.room_number),
       c.issue_type, c.description, c.priority::complaint_priority, c.status::complaint_status
from properties p
cross join (values
  ('Rahul Sharma', '101', 'Water leakage', 'Bathroom tap is leaking continuously', 'high', 'open'),
  ('Amit Verma',   '101', 'WiFi issue',    'WiFi disconnects frequently at night',  'medium', 'in_progress'),
  ('Suresh Patil', '102', 'Fan not working','Ceiling fan makes noise and is slow',  'low', 'resolved')
) as c(tenant_name, room_number, issue_type, description, priority, status)
where p.qr_slug = 'sunrise-pg-demo';

-- ---- 8. Expenses ----
insert into expenses (property_id, category, amount, notes, expense_date)
select p.id, e.category, e.amount, e.notes, e.expense_date::date
from properties p
cross join (values
  ('Electricity', 4500, 'June electricity bill', '2026-06-05'),
  ('Water',       1200, 'June water tanker',      '2026-06-06'),
  ('WiFi',        1499, 'Monthly broadband bill',  '2026-06-01'),
  ('Cleaning',    2000, 'Cleaning staff salary',   '2026-06-01'),
  ('Maintenance', 800,  'Plumber visit',           '2026-06-15')
) as e(category, amount, notes, expense_date)
where p.qr_slug = 'sunrise-pg-demo';

-- ============================================================================
-- DONE — Sunrise PG demo data created for demo2@gmail.com
-- Login at /login → PG Owner tab → demo2@gmail.com + the password you set
-- ============================================================================
