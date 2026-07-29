# OWNER_MANUAL.md

For property owners using the Owner dashboard (`/dashboard` and the
sections in its sidebar).

## Getting started
1. Log in with the account created for you (see `ADMIN_MANUAL.md` if you haven't received credentials).
2. Add your property under **Properties**, then add **Rooms** to it.
3. Invite tenants — see "Tenants" below.

## Sections

**Dashboard** — at-a-glance occupancy, pending payments, open complaints, recent activity.

**Properties / Rooms** — manage your buildings and room inventory (occupancy, rent amount, room type).

**Tenants** — add tenants, review the ones going through the onboarding wizard, view/manage active tenancies, generate ID cards (**Tenant Cards**), and process **Room Change** requests.

**Payments** — record rent/deposit/advance payments, handle partial payments, view late fees (calculated automatically — see `SYSTEM_DESIGN.md` for the shared calculation logic), generate PDF receipts.

**Approvals** — the queue for tenant-submitted requests: leave requests, rent extension requests, move-out requests (with move-out checklist), and profile update requests. Approve/reject each from here; tenants are notified via push either way.

**Expenses** — track property expenses separately from tenant payments (for your own P&L, not tenant-facing).

**Complaints** — tenant-submitted maintenance/issue reports; mark resolved when addressed.

**Notices** — post notices visible to all tenants at a property; track who's read each one (**Notice Reads**).

**Visitors / Parcels / Waiting List** — front-desk-style logs: visitor check-in/out, parcel receipt logging, and a waiting list for prospective tenants when rooms are full.

**Messages / Inbox** — message templates and the communication history log (see `SYSTEM_DESIGN.md`'s Communication Engine flow) — WhatsApp goes out via click-to-chat, not automatically.

**Reports** — aggregate views (occupancy, revenue, etc.) across your properties.

**Documents** — generated PDFs (agreements, receipts) in one place.

**Backup / Restore / Archive** — see `BACKUP_RESTORE_GUIDE.md`. Archive holds records you've explicitly archived (e.g. a past tenancy) without deleting them.

**Settings** — your profile, notification preferences (push notifications — see below), theme.

## Push notifications
Enable push notifications in Settings to get notified of tenant
requests, payments, and complaints in real time. On the mobile app,
this uses a different delivery mechanism than the website (see
`MOBILE_GUIDE.md`) but the same in-app settings toggle.

## Common questions
- **"A tenant says they can't log in"** — confirm their invitation was completed (check the Tenants list for their onboarding status) and that they're using the email/phone the invitation was sent to.
- **"A number looks wrong"** — rent, late fee, and advance-balance figures are computed by one shared function used everywhere (dashboard, payments list, tenant portal) — if a figure looks wrong, it'll be wrong in the same way everywhere, which usually means the underlying payment/date data is what's off, not the display.
