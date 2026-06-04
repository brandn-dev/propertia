CREATE TYPE "DeferredInvoiceBalanceStatus" AS ENUM ('OPEN', 'APPLIED', 'CANCELLED');

CREATE TABLE "DeferredInvoiceBalance" (
  "id" TEXT NOT NULL,
  "contractId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "sourceInvoiceId" TEXT NOT NULL,
  "sourceInvoiceItemId" TEXT NOT NULL,
  "resolvedInvoiceId" TEXT,
  "resolvedInvoiceItemId" TEXT,
  "sourceDescription" TEXT NOT NULL,
  "sourceItemType" "InvoiceItemType" NOT NULL,
  "originalAmount" DECIMAL(12, 2) NOT NULL,
  "deferredAmount" DECIMAL(12, 2) NOT NULL,
  "status" "DeferredInvoiceBalanceStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DeferredInvoiceBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeferredInvoiceBalance_resolvedInvoiceItemId_key"
ON "DeferredInvoiceBalance"("resolvedInvoiceItemId");

CREATE INDEX "DeferredInvoiceBalance_contractId_status_idx"
ON "DeferredInvoiceBalance"("contractId", "status");

CREATE INDEX "DeferredInvoiceBalance_tenantId_status_idx"
ON "DeferredInvoiceBalance"("tenantId", "status");

CREATE INDEX "DeferredInvoiceBalance_sourceInvoiceId_idx"
ON "DeferredInvoiceBalance"("sourceInvoiceId");

CREATE INDEX "DeferredInvoiceBalance_sourceInvoiceItemId_idx"
ON "DeferredInvoiceBalance"("sourceInvoiceItemId");

CREATE INDEX "DeferredInvoiceBalance_resolvedInvoiceId_idx"
ON "DeferredInvoiceBalance"("resolvedInvoiceId");

ALTER TABLE "DeferredInvoiceBalance"
ADD CONSTRAINT "DeferredInvoiceBalance_contractId_fkey"
FOREIGN KEY ("contractId") REFERENCES "Contract"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeferredInvoiceBalance"
ADD CONSTRAINT "DeferredInvoiceBalance_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DeferredInvoiceBalance"
ADD CONSTRAINT "DeferredInvoiceBalance_sourceInvoiceId_fkey"
FOREIGN KEY ("sourceInvoiceId") REFERENCES "Invoice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeferredInvoiceBalance"
ADD CONSTRAINT "DeferredInvoiceBalance_sourceInvoiceItemId_fkey"
FOREIGN KEY ("sourceInvoiceItemId") REFERENCES "InvoiceItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeferredInvoiceBalance"
ADD CONSTRAINT "DeferredInvoiceBalance_resolvedInvoiceId_fkey"
FOREIGN KEY ("resolvedInvoiceId") REFERENCES "Invoice"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DeferredInvoiceBalance"
ADD CONSTRAINT "DeferredInvoiceBalance_resolvedInvoiceItemId_fkey"
FOREIGN KEY ("resolvedInvoiceItemId") REFERENCES "InvoiceItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
