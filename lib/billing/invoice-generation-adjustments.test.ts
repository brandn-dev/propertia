import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCarryForwardAssignments,
  buildPersistedCarryForwardKey,
  buildSyntheticCarryForwardKey,
  calculateInvoiceGenerationLineOutcome,
  type InvoiceGenerationLineAdjustment,
} from "@/lib/billing/invoice-generation-adjustments";

function createAdjustment(
  overrides: Partial<InvoiceGenerationLineAdjustment> = {}
): InvoiceGenerationLineAdjustment {
  return {
    cycleSelectionKey: "cycle-1",
    lineId: "line-1",
    action: "FULL",
    valueType: "FIXED",
    value: 0,
    ...overrides,
  };
}

test("full billing leaves amount unchanged", () => {
  assert.deepEqual(
    calculateInvoiceGenerationLineOutcome({
      lineAmount: 10000,
      adjustment: createAdjustment(),
    }),
    {
      billedAmount: 10000,
      reductionAmount: 0,
      discountAmount: 0,
      deferredAmount: 0,
    }
  );
});

test("percent discount creates negative reduction without deferred amount", () => {
  assert.deepEqual(
    calculateInvoiceGenerationLineOutcome({
      lineAmount: 10000,
      adjustment: createAdjustment({
        action: "DISCOUNT",
        valueType: "PERCENT",
        value: 25,
      }),
    }),
    {
      billedAmount: 7500,
      reductionAmount: 2500,
      discountAmount: 2500,
      deferredAmount: 0,
    }
  );
});

test("fixed defer creates future balance and reduced billed amount", () => {
  assert.deepEqual(
    calculateInvoiceGenerationLineOutcome({
      lineAmount: 8250,
      adjustment: createAdjustment({
        action: "DEFER",
        valueType: "FIXED",
        value: 1250,
      }),
    }),
    {
      billedAmount: 7000,
      reductionAmount: 1250,
      discountAmount: 0,
      deferredAmount: 1250,
    }
  );
});

test("reduction cannot exceed original amount", () => {
  assert.deepEqual(
    calculateInvoiceGenerationLineOutcome({
      lineAmount: 1500,
      adjustment: createAdjustment({
        action: "DEFER",
        valueType: "FIXED",
        value: 9000,
      }),
    }),
    {
      billedAmount: 0,
      reductionAmount: 1500,
      discountAmount: 0,
      deferredAmount: 1500,
    }
  );
});

test("carry-forward assigns open balance to first eligible later cycle", () => {
  const assignments = buildCarryForwardAssignments({
    selectedCycles: [
      {
        cycleSelectionKey: "june",
        contractId: "contract-1",
        start: new Date("2026-06-01"),
        end: new Date("2026-06-30"),
      },
      {
        cycleSelectionKey: "july",
        contractId: "contract-1",
        start: new Date("2026-07-01"),
        end: new Date("2026-07-31"),
      },
      {
        cycleSelectionKey: "august",
        contractId: "contract-1",
        start: new Date("2026-08-01"),
        end: new Date("2026-08-31"),
      },
    ],
    sources: [
      {
        carryForwardKey: buildPersistedCarryForwardKey("deferred-1"),
        contractId: "contract-1",
        availableAfter: new Date("2026-06-30"),
        amount: 4000,
        sourceLabel: "June deferment",
      },
    ],
  });

  assert.deepEqual(assignments.get("june"), undefined);
  assert.equal(assignments.get("july")?.length, 1);
  assert.equal(assignments.get("july")?.[0]?.carryForwardKey, "persisted:deferred-1");
  assert.deepEqual(assignments.get("august"), undefined);
});

test("same-run synthetic deferment lands on next selected cycle only", () => {
  const assignments = buildCarryForwardAssignments({
    selectedCycles: [
      {
        cycleSelectionKey: "june",
        contractId: "contract-1",
        start: new Date("2026-06-01"),
        end: new Date("2026-06-30"),
      },
      {
        cycleSelectionKey: "july",
        contractId: "contract-1",
        start: new Date("2026-07-01"),
        end: new Date("2026-07-31"),
      },
    ],
    sources: [
      {
        carryForwardKey: buildSyntheticCarryForwardKey("june-rent"),
        contractId: "contract-1",
        availableAfter: new Date("2026-06-30"),
        amount: 3200,
        sourceLabel: "Rent for June 2026",
      },
    ],
  });

  assert.equal(assignments.get("july")?.[0]?.carryForwardKey, "synthetic:june-rent");
});
