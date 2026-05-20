import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
    }),
  });

  try {
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_enum e
          JOIN pg_type t ON t.oid = e.enumtypid
          WHERE t.typname = 'UserRole'
            AND e.enumlabel = 'METER_READER'
        ) THEN
          ALTER TYPE "UserRole" RENAME VALUE 'METER_READER' TO 'STAFF';
        END IF;
      END
      $$;
    `);

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'UserCapability'
        ) THEN
          CREATE TYPE "UserCapability" AS ENUM (
            'VIEW_DASHBOARD',
            'MANAGE_PROPERTIES',
            'MANAGE_TENANTS',
            'MANAGE_PEOPLE',
            'MANAGE_CONTRACTS',
            'MANAGE_BILLING',
            'MANAGE_INVOICE_TEMPLATES',
            'MANAGE_CHARGES',
            'MANAGE_BACKLOG',
            'MANAGE_COSA',
            'MANAGE_UTILITIES',
            'MANAGE_METERS',
            'RECORD_READINGS'
          );
        END IF;
      END
      $$;
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "capabilities" "UserCapability"[] NOT NULL DEFAULT ARRAY[]::"UserCapability"[],
      ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "avatarStorageKey" TEXT;
    `);

    await prisma.$executeRawUnsafe(`
      UPDATE "User"
      SET "capabilities" = ARRAY[
        'VIEW_DASHBOARD',
        'MANAGE_UTILITIES',
        'MANAGE_METERS',
        'RECORD_READINGS'
      ]::"UserCapability"[]
      WHERE "role" = 'STAFF'
        AND COALESCE(array_length("capabilities", 1), 0) = 0;
    `);

    const users = await prisma.$queryRawUnsafe<
      Array<{
        username: string;
        role: string;
        capabilities: string[];
        avatarUrl: string | null;
      }>
    >(`
      SELECT "username", "role", "capabilities", "avatarUrl"
      FROM "User"
      ORDER BY "username";
    `);

    console.log(JSON.stringify(users, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
