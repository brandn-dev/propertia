-- Speed up contract lookups used across billing, contracts, and tenant/property views.
CREATE INDEX "Contract_status_paymentStartDate_idx"
ON "Contract"("status", "paymentStartDate");

CREATE INDEX "Contract_tenantId_status_paymentStartDate_idx"
ON "Contract"("tenantId", "status", "paymentStartDate");

CREATE INDEX "Contract_status_endDate_idx"
ON "Contract"("status", "endDate");

-- Speed up billing monitors and invoice list ordering/filtering.
CREATE INDEX "Invoice_tenantId_status_dueDate_idx"
ON "Invoice"("tenantId", "status", "dueDate");

CREATE INDEX "Invoice_dueDate_issueDate_idx"
ON "Invoice"("dueDate", "issueDate");

-- Speed up shared meter pickers and property/tenant utility scoping.
CREATE INDEX "UtilityMeter_isShared_createdAt_idx"
ON "UtilityMeter"("isShared", "createdAt");

CREATE INDEX "UtilityMeter_propertyId_tenantId_isShared_idx"
ON "UtilityMeter"("propertyId", "tenantId", "isShared");

-- Speed up recent readings pages and meter timeline lookups.
CREATE INDEX "MeterReading_readingDate_createdAt_idx"
ON "MeterReading"("readingDate", "createdAt");

CREATE INDEX "MeterReading_meterId_readingDate_createdAt_idx"
ON "MeterReading"("meterId", "readingDate", "createdAt");
