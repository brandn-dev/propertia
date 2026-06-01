CREATE TYPE "InvoiceDateDisplayMode" AS ENUM ('SHOW', 'HIDE');

ALTER TABLE "Tenant"
ADD COLUMN "invoiceDescriptionDateDisplayDefault" "InvoiceDateDisplayMode" NOT NULL DEFAULT 'SHOW';

ALTER TABLE "ContractRecurringCharge"
ADD COLUMN "descriptionDateDisplayOverride" "InvoiceDateDisplayMode";
