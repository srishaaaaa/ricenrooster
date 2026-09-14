# Rice n' Rooster Supabase setup

## Quickest path: one file

Run **`supabase/all_in_one_setup.sql`** in the Supabase SQL Editor (dashboard → SQL Editor → New query → paste the whole file → Run). It sets up everything in one go: schema, tables, RPC functions, the Rice n' Rooster fried rice & chicken combo catalogue, flavour tags, and store settings — plus a few bug fixes (payment method whitelist, a missing `invoice_pdf_url` column, and RLS policies that would otherwise block the admin dashboard) that weren't captured in any individual migration file.

It's safe to re-run if something fails partway through — every statement is idempotent.

After it runs, create the owner account in Supabase Authentication and set its `role` metadata to `admin` if customer login is enabled.

## Alternative: migrations one at a time

`all_in_one_setup.sql` is generated from the files in `supabase/migrations/`, run in filename order. If you'd rather apply them individually (e.g. to track which one introduces an issue), run them in that same filename order, ending with `20260914_0001_rice_n_rooster_rebrand.sql`.

## Notes

The schema migration is idempotent. Invoice numbers are generated as sequential 8-digit values (see `20260722_0005_eight_digit_invoice_numbers.sql`) and displayed on-screen with an `INV` prefix; allocation happens under a locked database counter/sequence to prevent duplicates during concurrent billing.
