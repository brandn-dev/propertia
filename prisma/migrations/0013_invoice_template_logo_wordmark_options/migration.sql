ALTER TABLE "InvoiceBrandingTemplate"
ADD COLUMN "showBrandName" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showBrandSubtitle" BOOLEAN NOT NULL DEFAULT true;
