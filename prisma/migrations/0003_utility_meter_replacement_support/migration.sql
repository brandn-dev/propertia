-- AlterTable
ALTER TABLE "UtilityMeter"
ADD COLUMN "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "retiredAt" TIMESTAMP(3),
ADD COLUMN "openingReading" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN "replacesMeterId" TEXT;

-- CreateIndex
CREATE INDEX "UtilityMeter_retiredAt_idx" ON "UtilityMeter"("retiredAt");

-- CreateIndex
CREATE INDEX "UtilityMeter_replacesMeterId_idx" ON "UtilityMeter"("replacesMeterId");

-- AddForeignKey
ALTER TABLE "UtilityMeter"
ADD CONSTRAINT "UtilityMeter_replacesMeterId_fkey"
FOREIGN KEY ("replacesMeterId") REFERENCES "UtilityMeter"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
