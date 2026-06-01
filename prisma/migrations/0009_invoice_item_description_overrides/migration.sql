CREATE TYPE "InvoiceItemDescriptionMode" AS ENUM ('AUTO', 'SHOW', 'HIDE', 'CUSTOM');

ALTER TABLE "InvoiceItem"
ADD COLUMN "descriptionMode" "InvoiceItemDescriptionMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN "customDescription" TEXT;
