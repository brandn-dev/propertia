import assert from "node:assert/strict";
import test from "node:test";
import { calculateInvoiceAdjustmentAmount } from "@/lib/billing/invoice-adjustments";

test("fixed invoice adjustment keeps entered peso amount", () => {
  assert.equal(
    calculateInvoiceAdjustmentAmount({
      valueType: "FIXED",
      value: 1250.5,
      basisAmount: 10000,
    }),
    1250.5
  );
});

test("percentage invoice adjustment uses original target basis", () => {
  assert.equal(
    calculateInvoiceAdjustmentAmount({
      valueType: "PERCENTAGE",
      value: 20,
      basisAmount: 18000,
    }),
    3600
  );
});

test("percentage invoice adjustment rounds to cents", () => {
  assert.equal(
    calculateInvoiceAdjustmentAmount({
      valueType: "PERCENTAGE",
      value: 7.5,
      basisAmount: 999.99,
    }),
    75
  );
});
