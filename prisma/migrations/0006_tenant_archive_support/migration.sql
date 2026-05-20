CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "Tenant"
ADD COLUMN "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Tenant_status_createdAt_idx" ON "Tenant"("status", "createdAt");
