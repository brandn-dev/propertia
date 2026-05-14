import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPropertyGroups,
  createHistoricalBacklogMonthDraft,
  createUtilityReadingDraft,
  getDraftForCycle,
  serializeMonthDraft,
  updateDraftMapForCycle,
  type HistoricalBacklogContractOption,
  type HistoricalBacklogDraftMap,
} from "@/lib/billing/historical-backlog-drafts";
import { backlogBulkRowSchema } from "@/lib/validations/historical-backlog";

function createContractFixture(
  overrides: Partial<HistoricalBacklogContractOption> = {}
): HistoricalBacklogContractOption {
  return {
    id: "contract-1",
    tenantId: "tenant-1",
    status: "ACTIVE",
    paymentStartDate: "2024-01-01T00:00:00.000Z",
    endDate: "2026-12-31T00:00:00.000Z",
    monthlyRent: "10000",
    freeRentCycles: 0,
    advanceRentMonths: 0,
    advanceRentApplication: "FIRST_BILLABLE_CYCLES",
    advanceRentFirstMonths: 0,
    advanceRentLastMonths: 0,
    advanceRent: "0",
    rentAdjustments: [],
    property: {
      id: "property-1",
      name: "Alpha Arcade",
      propertyCode: "AA-101",
    },
    tenant: {
      firstName: null,
      lastName: null,
      businessName: "Coco Nails",
    },
    recurringCharges: [
      {
        id: "rc-1",
        chargeType: "ASSOCIATION_DUES",
        label: "Association dues",
        amount: "1200",
        effectiveStartDate: "2024-01-01T00:00:00.000Z",
        effectiveEndDate: null,
        isActive: true,
      },
    ],
    meters: [
      {
        id: "meter-1",
        propertyId: "property-1",
        tenantId: "tenant-1",
        meterCode: "MTR-ELEC",
        utilityType: "ELECTRICITY",
        openingReading: "0",
        readings: [
          {
            id: "persisted-1",
            readingDate: "2024-03-31T00:00:00.000Z",
            currentReading: "25",
            ratePerUnit: "12.50",
          },
        ],
      },
    ],
    pendingBacklogCycles: [
      {
        key: "2024-04",
        start: "2024-04-01T00:00:00.000Z",
        end: "2024-04-30T00:00:00.000Z",
        label: "April 2024",
      },
      {
        key: "2024-05",
        start: "2024-05-01T00:00:00.000Z",
        end: "2024-05-31T00:00:00.000Z",
        label: "May 2024",
      },
    ],
    ...overrides,
  };
}

test("groups many missing months into one property row", () => {
  const contract = createContractFixture();
  const groups = buildPropertyGroups([contract], contract.tenantId, "ALL");

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.months.length, 2);
  assert.equal(groups[0]?.contractLabel, "AA-101 · Alpha Arcade");
});

test("persisted prior reading seeds first unsaved month and carry-forward updates later month", () => {
  const contract = createContractFixture();
  const april = contract.pendingBacklogCycles[0]!;
  const may = contract.pendingBacklogCycles[1]!;
  let drafts: HistoricalBacklogDraftMap = {};

  drafts = updateDraftMapForCycle(drafts, contract, april, (draft) => {
    const row = createUtilityReadingDraft(contract, april);

    return {
      ...draft,
      utilityReadings: [
        {
          ...row,
          currentReading: "40",
        },
      ],
    };
  });

  const aprilDraft = getDraftForCycle({ drafts, contract, cycle: april });
  assert.equal(aprilDraft?.utilityReadings[0]?.previousReading, "25");
  assert.equal(aprilDraft?.utilityReadings[0]?.ratePerUnit, "12.50");

  drafts = updateDraftMapForCycle(drafts, contract, may, (draft) => {
    const row = createUtilityReadingDraft(contract, may);

    return {
      ...draft,
      utilityReadings: [
        {
          ...row,
          currentReading: "52",
        },
      ],
    };
  });

  let mayDraft = getDraftForCycle({ drafts, contract, cycle: may });
  assert.equal(mayDraft?.utilityReadings[0]?.previousReading, "40");

  drafts = updateDraftMapForCycle(drafts, contract, april, (draft) => ({
    ...draft,
    utilityReadings: draft.utilityReadings.map((row) =>
      row.meterId === "meter-1" ? { ...row, currentReading: "47" } : row
    ),
  }));

  mayDraft = getDraftForCycle({ drafts, contract, cycle: may });
  assert.equal(mayDraft?.utilityReadings[0]?.previousReading, "47");
  assert.equal(mayDraft?.utilityReadings[0]?.currentReading, "52");
});

test("bulk row schema accepts nested month draft payload", () => {
  const contract = createContractFixture();
  const april = contract.pendingBacklogCycles[0]!;
  const draft = createHistoricalBacklogMonthDraft(contract, april);
  const parsed = backlogBulkRowSchema.safeParse({
    rowKey: draft.rowKey,
    ...serializeMonthDraft({
      ...draft,
      utilityCharges: [
        {
          id: "utility-1",
          utilityType: "WATER",
          label: "Manual water bill",
          amount: "500",
        },
      ],
      adjustments: [
        {
          id: "adjustment-1",
          itemType: "ARREARS",
          label: "Prior balance",
          amount: "250",
        },
      ],
    }),
  });

  assert.equal(parsed.success, true);
});
