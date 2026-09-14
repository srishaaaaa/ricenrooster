# Rice n' Rooster Billing

Independent React, Vite, and Supabase billing administration for Rice n' Rooster.

## Local setup

1. Copy `.env.example` to `.env` and add the dedicated Rice n' Rooster Supabase URL, public key, and portal passwords.
2. Apply the SQL files in `supabase/migrations` in filename order.
3. Run `npm install`.
4. Run `npm run dev`.

The app keeps the established dashboard, POS billing, catalog, category, coupon, invoice, receipt, WhatsApp, and print flows. Local browser sessions use Rice n' Rooster-specific storage keys and do not share state with other shop projects.

## Environment

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_WHATSAPP_NUMBER=919363400210`
- `VITE_ADMIN_ID`
- `VITE_ADMIN_PASSWORD`
- `VITE_STAFF_ID` (optional; defaults to `VITE_ADMIN_ID`)
- `VITE_STAFF_PASSWORD`

The site logo lives at `public/logo.png` and `public/rice-n-rooster-logo.jpeg` (used for social/OG previews and the invoice PDF). Replace both with the final Rice n' Rooster logo artwork when supplied, then run `node gen_logo.cjs` to regenerate `src/lib/logoBase64.ts` for the PDF invoice.
