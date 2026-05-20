-- Rename legacy meter-reader role into generic staff role.
ALTER TYPE "UserRole" RENAME VALUE 'METER_READER' TO 'STAFF';

-- Add a capability enum for fine-grained staff access.
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

ALTER TABLE "User"
  ADD COLUMN "capabilities" "UserCapability"[] NOT NULL DEFAULT ARRAY[]::"UserCapability"[],
  ADD COLUMN "avatarUrl" TEXT,
  ADD COLUMN "avatarStorageKey" TEXT;

UPDATE "User"
SET "capabilities" = ARRAY[
  'VIEW_DASHBOARD',
  'MANAGE_UTILITIES',
  'MANAGE_METERS',
  'RECORD_READINGS'
]::"UserCapability"[]
WHERE "role" = 'STAFF';
