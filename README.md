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
- the seed script creates or updates the initial admin and meter-reader accounts from these values.

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
