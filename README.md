# PG Manager — SaaS for Indian PG/Hostel Management

Next.js 15 + TypeScript + Tailwind + shadcn-style UI + Supabase (DB + Auth) + Vercel.

## What's included

- **Super Admin** dashboard (`/admin`) — add/manage PG Owners
- **PG Owner** dashboard (`/dashboard`, `/rooms`, `/tenants`, `/payments`, `/approvals`, `/complaints`, `/expenses`, `/reports`, `/settings`) — multi-property switcher (All Properties or one specific PG)
- **Tenant Portal** (`/portal`) — rent status, mark-as-paid (owner-approved), payment history, agreement, complaints, change password
- **Public Join Link** (`/join/[slug]`) — QR/link based tenant self-onboarding, goes to owner's Approvals page
- Partial payments with **Collected By** attribution (multiple collectors per property)
- Pending rent sorted by due date (computed from each tenant's joining day)
- WhatsApp + Call reminder buttons throughout

## 1. Supabase Setup

1. Go to [supabase.com](https://supabase.com) → New Project (choose Mumbai/Singapore region, free tier)
2. Once created, go to **SQL Editor** → paste the entire contents of `supabase/schema.sql` → Run
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` public key

## 2. Local Setup

```bash
npm install
cp .env.local.example .env.local
# edit .env.local and paste your Supabase URL + anon key
npm run dev
```

Visit `http://localhost:3000`.

## 3. Create your Super Admin account

There's no signup UI for admins by design (security). After deploying:

1. In Supabase Dashboard → **Authentication → Users** → "Add User" → enter your email + password → confirm email automatically.
2. Go to **Table Editor → profiles** → find the row with your new user's `id` → change `role` from `pg_owner` to `super_admin`.
3. Now log in at `/login` with that email — you'll land on `/admin`.

From `/admin` you can create PG Owner accounts (name, email, phone, temp password) — share those credentials with each owner.

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — PG Manager SaaS"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 5. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → Import your GitHub repo
2. In **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_APP_URL` (set to your Vercel URL once deployed, e.g. `https://your-app.vercel.app`)
3. Click **Deploy**

Every time you `git push`, Vercel auto-redeploys.

## How the roles work

| Role | Login | Sees |
|---|---|---|
| Super Admin | Email + password (set manually in Supabase, see step 3) | All PG owners, can add/deactivate owners |
| PG Owner | Email + password (given by Super Admin) | Only their own properties (enforced by Row Level Security) |
| Tenant | Mobile number + password (set by owner, or auto after QR approval) | Only their own tenant record & payments |

Row Level Security (RLS) in `supabase/schema.sql` enforces all of this at the database level — even if someone tampers with the frontend, Supabase itself blocks cross-owner data access.

## Tenant self-onboarding via QR

1. Owner opens **Approvals → Tenant Join Link / QR**, gets a unique link like `yourapp.vercel.app/join/sunrise-pg-x7k2`
2. Share via WhatsApp or print the QR
3. Prospective tenant scans/opens it, fills their own details (name, room wish, rent, deposit — including partial deposit paid) — **no login needed**
4. Request appears in owner's **Approvals → New Tenant Requests**
5. Owner approves + sets a password → tenant login is created automatically

## Notes / things to wire up later

- File uploads (Aadhaar, PAN, agreement PDFs, room photos) need Supabase **Storage** buckets — not yet wired into the UI forms, but the DB columns (`aadhaar_url`, `pan_url`, etc.) are ready for it.
- PDF/Excel export buttons currently show toast confirmations only — hook up `jspdf` / `xlsx` (already in `package.json`) when ready.
- WhatsApp reminder buttons open `wa.me` links (no API cost, uses the user's own WhatsApp) — for automatic scheduled reminders you'd need the WhatsApp Business API later.
