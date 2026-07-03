import test from "node:test";
import assert from "node:assert/strict";
import {
  findNextCompletedBillingCycles,
  getBillingCycleKey,
  getInvoiceGenerationSelectionKey,
} from "@/lib/billing/cycles";

test("billing cycle keys use app timezone calendar dates", () => {
  const [cycle] = findNextCompletedBillingCycles({
    anchorDate: new Date("2026-07-01T00:00:00.000Z"),
    contractEndDate: new Date("2026-12-31T00:00:00.000Z"),
    issueDate: new Date("2026-07-01T15:59:59.999Z"),
    existingPeriods: new Set(),
    includeCurrentCycle: true,
    includeNextCycleInIssueMonth: true,
  });

  assert.equal(getBillingCycleKey(cycle.start, cycle.end), "2026-07-01:2026-07-31");
  assert.equal(
    getInvoiceGenerationSelectionKey("contract-1", cycle.start, cycle.end),
    "contract-1::2026-07-01:2026-07-31"
  );
});
