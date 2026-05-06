-- CreateEnum
CREATE TYPE "InvoiceOrigin" AS ENUM ('GENERATED', 'BACKLOG');

-- CreateEnum
CREATE TYPE "MeterReadingOrigin" AS ENUM ('OPERATIONAL', 'BACKLOG');

-- AlterTable
ALTER TABLE "Invoice"
ADD COLUMN "notes" TEXT,
ADD COLUMN "origin" "InvoiceOrigin" NOT NULL DEFAULT 'GENERATED';

-- AlterTable
ALTER TABLE "MeterReading"
ADD COLUMN "origin" "MeterReadingOrigin" NOT NULL DEFAULT 'OPERATIONAL';
