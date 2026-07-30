# VALIDATION_REPORT.md

## What this covers
A real audit of actual forms in this codebase against the field-level
rules requested (name, mobile, email, PAN, Aadhaar, IFSC, account
number, rent, deposit, dates, dropdowns, uploads, duplicate-submission
prevention). Given the size of this app (~40 pages), this pass focused
on the two highest-value, most field-heavy forms rather than a
mechanical pass over every page — see "Not covered" below for an honest
account of the rest.

## New shared utility: `src/lib/validation.ts`
Added so every rule requested has one canonical, reusable
implementation, ready to adopt in any form without rewriting that
form's structure:
`validateName`, `validateMobile`, `validateEmail`, `validatePAN`,
`validateAadhaar`, `validateIFSC`, `validateAccountNumber`,
`validateUPI`, `validatePositiveAmount`, `validateRequiredDate`,
`validateRequiredSelection`, `validateUpload`, and `friendlyError` (maps
a raw caught error to a user-safe message, filtering out raw
Postgrest/JWT error codes).

## Tenant onboarding / join form (`(auth)/join/[slug]/page.tsx`)
**Already solid before this pass** — contains real step-by-step
validation (not absent, just not using the new shared utility yet):
name required, phone digit-count check, email format check, government
ID upload required, emergency contact required, start date required,
monthly rent > 0, deposit ≥ 0, and — a real positive finding — money
fields already use `inputMode="numeric"` for the correct mobile
keyboard.

**Fixed:**
- Mobile number accepted 11+ digits (`< 10` instead of `!== 10`) — an
  Indian mobile number with an accidental country-code prefix
  (`919876543210`, 12 digits) would have passed as valid. Now requires
  exactly 10.
- No maximum length on the name field — added (80 characters).

**Not changed:** PAN and Aadhaar are collected here as **photo
uploads** (`aadhaar_url`/`pan_url`), not typed numbers — the
PAN/Aadhaar *format* validators in the new utility don't apply to this
form as built. If a future form ever collects these as typed digits
instead of an uploaded photo, `validatePAN`/`validateAadhaar` are ready
to use.

## Property creation (`AddPropertyModal.tsx`)
Shared by both the Topbar property switcher and the Properties page
(per its own docstring) — one fix here benefits both surfaces.

**Fixed:**
- Name validation upgraded to the shared `validateName` (trims,
  enforces min/max length, rejects space-only input) — was previously
  just a non-empty check.
- **UPI ID had zero format validation** — now validated with
  `validateUPI` (optional field, but checked if provided).
- Replaced `catch (e: any)` + raw `e.message` with `friendlyError(e)`,
  so a raw Postgrest error code can no longer reach the user directly.

## IFSC / Account Number — not applicable anywhere in this app
Searched the entire codebase: `bank_ifsc` and `bank_account_number`
exist as **database columns** (`properties` table) but no form in the
UI actually collects or edits them — payment collection is built
entirely around `upi_id` instead (used in `AddPropertyModal`, owner
settings, the join form, and the tenant portal). `validateIFSC` and
`validateAccountNumber` are implemented and ready in the shared utility
in case a future bank-details form is added, but there was no existing
form to apply them to — and adding a new form field would be a new
business feature, out of scope for this audit ("do not add any new
business features").

## Not covered in this pass
- Every other form with user input (add tenant manually, expenses,
  complaints, notices, visitor/parcel logging, owner settings, admin's
  add-owner form, etc.) — not individually audited or upgraded to the
  shared utility. None were found broken during general codebase
  review, but "not found broken while skimming" is a lower bar than
  "audited," and I want to be precise about that distinction rather
  than imply full coverage.
- Focus-first-invalid-field behavior — not implemented on any form in
  this pass (existing forms surface the first validation failure via a
  toast, not a focus jump). A real UX improvement, scoped out to avoid
  touching the interaction structure of forms outside this pass's two
  targets.

## Recommended next steps
Roll the shared `validation.ts` utility out to the remaining forms
incrementally, form by form, with a real dev build available to verify
each change — the same reasoning as the `any`-usage debt in
`PRODUCTION_AUDIT.md`: doing this blind, across dozens of forms, without
a compiler/runtime to check against is a bigger risk than the current
state.
