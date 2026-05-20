ALTER TABLE "CosaTemplateAllocation"
ADD COLUMN "helperLabel" TEXT,
ALTER COLUMN "contractId" DROP NOT NULL;

ALTER TABLE "COSAAllocation"
ADD COLUMN "helperLabel" TEXT,
ALTER COLUMN "contractId" DROP NOT NULL;
