# Propertia

Propertia is a Next.js 16 property management dashboard scaffolded for:

- `Prisma 7`
- `PostgreSQL` / `Neon Postgres`
- `iron-session` cookie auth
- `scrypt` password hashing
- latest `shadcn/ui` with sidebar layout
- light and dark mode via `next-themes`

## Current Scope

The repo now includes:

- a Prisma schema for users, properties, tenants, contracts, invoices, payments, utilities, COSA, and deductions
- a seeded two-role auth model:
  - `ADMIN`
  - `METER_READER`
- a protected sidebar dashboard shell
- starter pages for dashboard, properties, tenants, contracts, billing, and utilities
- an initial SQL migration at `prisma/migrations/0001_init/migration.sql`

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
DATABASE_URL=
SESSION_PASSWORD=
APP_URL=
INVOICE_PDF_RENDER_MODE=
INVOICE_PDF_RENDER_BASE_URL=
GOTENBERG_URL=
INVOICE_PDF_DEBUG_HEADERS=
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_DISPLAY_NAME=
METER_READER_USERNAME=
METER_READER_PASSWORD=
METER_READER_DISPLAY_NAME=
```

Notes:

- `DATABASE_URL` should point to your Neon or PostgreSQL database.
- `SESSION_PASSWORD` must be at least 32 characters long.
- `APP_URL` should be the public base URL used in generated invoice links and QR codes.
- `INVOICE_PDF_RENDER_MODE` supports `gotenberg`, `chromium`, or `react-pdf`; use `gotenberg` in production.
- `INVOICE_PDF_RENDER_BASE_URL` should be the URL that Gotenberg can reach for this app, such as `https://propertia.brandn.dev`.
- `GOTENBERG_URL` is required when using `gotenberg`, such as `http://gotenberg:3000` on a shared Docker network.
- `INVOICE_PDF_DEBUG_HEADERS=1` enables renderer/debug headers on invoice PDF responses.
- the seed script creates or updates the initial admin and meter-reader accounts from these values.

## Invoice PDF Rendering

Recommended production setup:

- the app serves invoice HTML routes
- Coolify/Docker runs Gotenberg as a separate service reachable from the app container
- `INVOICE_PDF_RENDER_MODE=gotenberg`
- `GOTENBERG_URL=http://<gotenberg-service>:3000`
- `INVOICE_PDF_RENDER_BASE_URL=https://propertia.brandn.dev`
- `INVOICE_PDF_DEBUG_HEADERS=1` while debugging
- local and deployed should share `DATABASE_URL` if you expect identical invoice output

Debugging helpers:

- protected render diagnostics: `/billing/:invoiceId/pdf/debug`
- optional PDF debug headers via `INVOICE_PDF_DEBUG_HEADERS=1`
- if PDF rendering fails, check `renderBaseUrl` in the debug route and verify Gotenberg can reach it

If local and deployed output differs, check data parity first, then renderer/layout.

## First Run

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

If you prefer migration-based setup against a fresh database:

```bash
npx prisma migrate deploy
npm run db:seed
```

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:migrate
npm run db:push
npm run db:seed
npm run db:studio
```
