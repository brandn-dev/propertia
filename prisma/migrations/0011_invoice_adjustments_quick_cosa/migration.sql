CREATE TYPE "InvoiceAdjustmentType" AS ENUM ('ADDITION', 'DEDUCTION');
CREATE TYPE "InvoiceAdjustmentValueType" AS ENUM ('FIXED', 'PERCENTAGE');
CREATE TYPE "InvoiceAdjustmentSource" AS ENUM ('MANUAL', 'SYSTEM', 'BACKLOG');
CREATE TYPE "CosaCalculationMode" AS ENUM ('METER_READING', 'DAILY_RATE', 'MANUAL_TOTAL');

ALTER TABLE "COSA"
ADD COLUMN "calculationMode" "CosaCalculationMode" NOT NULL DEFAULT 'MANUAL_TOTAL',
ADD COLUMN "quantity" DECIMAL(12,2),
ADD COLUMN "unitRate" DECIMAL(12,2);

ALTER TABLE "CosaTemplate"
ADD COLUMN "calculationMode" "CosaCalculationMode" NOT NULL DEFAULT 'MANUAL_TOTAL',
ADD COLUMN "dailyRate" DECIMAL(12,2);

UPDATE "COSA"
SET "calculationMode" = 'METER_READING'
WHERE "meterReadingId" IS NOT NULL;

UPDATE "CosaTemplate"
SET "calculationMode" = 'METER_READING'
WHERE "meterId" IS NOT NULL;

CREATE TABLE "InvoiceAdjustment" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "adjustmentInvoiceItemId" TEXT NOT NULL,
  "targetInvoiceItemId" TEXT,
  "adjustmentType" "InvoiceAdjustmentType" NOT NULL,
  "valueType" "InvoiceAdjustmentValueType" NOT NULL,
  "enteredValue" DECIMAL(12,2) NOT NULL,
  "calculatedAmount" DECIMAL(12,2) NOT NULL,
  "label" TEXT NOT NULL,
  "source" "InvoiceAdjustmentSource" NOT NULL DEFAULT 'MANUAL',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvoiceAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceAdjustment_adjustmentInvoiceItemId_key"
ON "InvoiceAdjustment"("adjustmentInvoiceItemId");
CREATE INDEX "InvoiceAdjustment_invoiceId_createdAt_idx"
ON "InvoiceAdjustment"("invoiceId", "createdAt");
CREATE INDEX "InvoiceAdjustment_targetInvoiceItemId_idx"
ON "InvoiceAdjustment"("targetInvoiceItemId");
CREATE INDEX "InvoiceAdjustment_adjustmentType_createdAt_idx"
ON "InvoiceAdjustment"("adjustmentType", "createdAt");
CREATE INDEX "InvoiceAdjustment_createdById_idx"
ON "InvoiceAdjustment"("createdById");

ALTER TABLE "InvoiceAdjustment"
ADD CONSTRAINT "InvoiceAdjustment_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceAdjustment"
ADD CONSTRAINT "InvoiceAdjustment_adjustmentInvoiceItemId_fkey"
FOREIGN KEY ("adjustmentInvoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvoiceAdjustment"
ADD CONSTRAINT "InvoiceAdjustment_targetInvoiceItemId_fkey"
FOREIGN KEY ("targetInvoiceItemId") REFERENCES "InvoiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InvoiceAdjustment"
ADD CONSTRAINT "InvoiceAdjustment_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "InvoiceAdjustment" (
  "id", "invoiceId", "adjustmentInvoiceItemId", "adjustmentType",
  "valueType", "enteredValue", "calculatedAmount", "label", "source", "createdAt"
)
SELECT
  'backfill_' || md5(item."id" || item."createdAt"::text),
  item."invoiceId",
  item."id",
  CASE WHEN item."amount" < 0 THEN 'DEDUCTION'::"InvoiceAdjustmentType"
       ELSE 'ADDITION'::"InvoiceAdjustmentType" END,
  'FIXED'::"InvoiceAdjustmentValueType",
  ABS(item."amount"),
  ABS(item."amount"),
  item."description",
  CASE WHEN invoice."origin" = 'BACKLOG' THEN 'BACKLOG'::"InvoiceAdjustmentSource"
       ELSE 'SYSTEM'::"InvoiceAdjustmentSource" END,
  item."createdAt"
FROM "InvoiceItem" item
JOIN "Invoice" invoice ON invoice."id" = item."invoiceId"
WHERE item."itemType" = 'ADJUSTMENT';
