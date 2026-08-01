import assert from "node:assert/strict";
import test from "node:test";
import { cosaSchema } from "@/lib/validations/cosa";

const allocation = {
  entryId: "contract-1",
  contractId: "contract-1",
  helperLabel: "",
  percentage: "100",
  unitCount: "",
  amount: "",
};

test("daily-rate COSA accepts decimal work days", () => {
  const result = cosaSchema.safeParse({
    propertyId: "property-1",
    meterId: "",
    meterReadingId: "",
    description: "Maintenance Staff Salary",
    totalAmount: "16400",
    calculationMode: "DAILY_RATE",
    quantity: "20.5",
    unitRate: "800",
    billingDate: "2026-08-31",
    allocationType: "PERCENTAGE",
    allocations: [allocation],
    successRedirectTo: "",
  });

  assert.equal(result.success, true);
});

test("daily-rate COSA rejects total that does not match days times rate", () => {
  const result = cosaSchema.safeParse({
    propertyId: "property-1",
    meterId: "",
    meterReadingId: "",
    description: "Security Guard Salary",
    totalAmount: "16000",
    calculationMode: "DAILY_RATE",
    quantity: "20.5",
    unitRate: "800",
    billingDate: "2026-08-31",
    allocationType: "PERCENTAGE",
    allocations: [allocation],
    successRedirectTo: "",
  });

  assert.equal(result.success, false);
});
