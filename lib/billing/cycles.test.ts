import test from "node:test";
import assert from "node:assert/strict";
import {
  findCosaTargetBillingCycle,
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

const augustCycle = {
  start: new Date("2026-08-01T00:00:00.000Z"),
  end: new Date("2026-08-31T23:59:59.999Z"),
};
const septemberCycle = {
  start: new Date("2026-09-01T00:00:00.000Z"),
  end: new Date("2026-09-30T23:59:59.999Z"),
};
const octoberCycle = {
  start: new Date("2026-10-01T00:00:00.000Z"),
  end: new Date("2026-10-31T23:59:59.999Z"),
};
const septemberIssueDate = new Date("2026-09-01T23:59:59.999Z");

test("carries an August 31 COSA into September when August is already invoiced", () => {
  const target = findCosaTargetBillingCycle({
    billingDate: new Date("2026-08-31T15:59:59.999Z"),
    issueDate: septemberIssueDate,
    pendingCycles: [septemberCycle, octoberCycle],
  });

  assert.equal(target, septemberCycle);
});

test("keeps COSA in its original cycle when that cycle is still pending", () => {
  const target = findCosaTargetBillingCycle({
    billingDate: new Date("2026-08-31T15:59:59.999Z"),
    issueDate: septemberIssueDate,
    pendingCycles: [augustCycle, septemberCycle],
  });

  assert.equal(target, augustCycle);
});

test("assigns older stranded COSA to only the earliest pending cycle", () => {
  const target = findCosaTargetBillingCycle({
    billingDate: new Date("2026-06-30T15:59:59.999Z"),
    issueDate: septemberIssueDate,
    pendingCycles: [octoberCycle, septemberCycle],
  });

  assert.equal(target, septemberCycle);
});

test("excludes COSA dated after the invoice issue date", () => {
  const target = findCosaTargetBillingCycle({
    billingDate: new Date("2026-09-02T15:59:59.999Z"),
    issueDate: septemberIssueDate,
    pendingCycles: [septemberCycle, octoberCycle],
  });

  assert.equal(target, null);
});
