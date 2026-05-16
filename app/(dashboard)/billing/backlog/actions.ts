"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireRole } from "@/lib/auth/user";
import {
  getHistoricalBacklogCutoffDate,
  getHistoricalBacklogLatestDate,
} from "@/lib/billing/backlog";
import {
  filterCyclesWithoutInvoicedMonths,
  findNextCompletedBillingCycles,
  formatBillingCycleLabel,
  getBillingCycleAtIndex,
  getBillingCycleIndex,
  getBillingCycleKey,
  getBillingMonthKey,
  cycleOverlapsRange,
} from "@/lib/billing/cycles";
import { buildInvoiceNumber } from "@/lib/billing/invoice-number";
import { generateInvoiceAccessCode } from "@/lib/billing/public-access";
import {
  buildAdvanceApplicationCycleIndexes,
  deriveWholeMonths,
} from "@/lib/contracts/advance-rent";
import {
  RECURRING_CHARGE_TYPE_LABELS,
  UTILITY_TYPE_LABELS,
} from "@/lib/form-options";
import { toDateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { withToast } from "@/lib/toast";
import {
  backlogBulkRowSchema,
  historicalBacklogSchema,
  type HistoricalBacklogInput,
  type HistoricalBacklogBulkRowInput,
} from "@/lib/validations/historical-backlog";

export type HistoricalBacklogFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
  rowKey?: string;
  refreshRequired?: boolean;
};

export type HistoricalBacklogBulkFormState = {
  message?: string;
  rowErrors?: Record<string, string[] | undefined>;
  savedRowKeys?: string[];
  savedRows?: Array<{
    rowKey: string;
    invoiceId: string;
  }>;
  refreshRequired?: boolean;
};

type ParsedHistoricalBacklogPayload = ReturnType<typeof getHistoricalBacklogPayload>;
type ParsedHistoricalBacklogBulkPayload = ReturnType<
  typeof getHistoricalBacklogBulkPayload
>;

type MeterTimelineEntry = {
  id: string;
  readingDate: Date;
  previousReading: number;
  currentReading: number;
  ratePerUnit: number;
  invoiceItemId: string | null;
};

type BacklogContractRecord = {
  id: string;
  tenantId: string;
  paymentStartDate: Date;
  endDate: Date;
  monthlyRent: { toString(): string };
  freeRentCycles: number;
  advanceRentMonths: number;
  advanceRentApplication:
    | "FIRST_BILLABLE_CYCLES"
    | "LAST_BILLABLE_CYCLES"
    | "SPLIT_FIRST_AND_LAST_CYCLES";
  advanceRentFirstMonths: number;
  advanceRentLastMonths: number;
  advanceRent: { toString(): string };
  property: {
    id: string;
    name: string;
    propertyCode: string;
  };
  recurringCharges: Array<{
    id: string;
    chargeType: keyof typeof RECURRING_CHARGE_TYPE_LABELS;
    label: string;
    amount: { toString(): string };
    effectiveStartDate: Date;
    effectiveEndDate: Date | null;
    isActive: boolean;
  }>;
  invoices: Array<{
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
  }>;
};

type CreatedReadingRow = {
  meterId: string;
  meterCode: string;
  utilityType: keyof typeof UTILITY_TYPE_LABELS;
  tenantId: string;
  readingDate: Date;
  previousReading: number;
  currentReading: number;
  consumption: number;
  ratePerUnit: number;
  totalAmount: number;
};

type BacklogAdjustmentLine = {
  itemType: "ADJUSTMENT" | "ARREARS";
  label: string;
  amount: number;
};

type BacklogRecurringChargeLine = {
  id: string;
  label: string;
  amount: number;
};

type BacklogPaymentSnapshot = {
  status: "UNPAID" | "PARTIAL" | "PAID";
  amount?: string | undefined;
  paymentDate?: string | undefined;
  referenceNumber?: string | undefined;
  notes?: string | undefined;
};

function parseSerializedRows(
  value: FormDataEntryValue | null,
  errorMessage: string
) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return {
      rows: [],
      error: null,
    };
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return {
        rows: [],
        error: errorMessage,
      };
    }

    return {
      rows: parsed,
      error: null,
    };
  } catch {
    return {
      rows: [],
      error: errorMessage,
    };
  }
}

function getHistoricalBacklogPayload(formData: FormData) {
  const utilityReadingsResult = parseSerializedRows(
    formData.get("utilityReadings"),
    "Utility reading rows could not be read. Try again."
  );
  const recurringChargeIdsResult = parseSerializedRows(
    formData.get("recurringChargeIds"),
    "Recurring charge rows could not be read. Try again."
  );
  const utilityChargesResult = parseSerializedRows(
    formData.get("utilityCharges"),
    "Utility charge rows could not be read. Try again."
  );
  const adjustmentsResult = parseSerializedRows(
    formData.get("adjustments"),
    "Adjustment rows could not be read. Try again."
  );

  return {
    rowKey: String(formData.get("rowKey") ?? ""),
    contractId: String(formData.get("contractId") ?? ""),
    billingPeriodStart: String(formData.get("billingPeriodStart") ?? ""),
    billingPeriodEnd: String(formData.get("billingPeriodEnd") ?? ""),
    issueDate: String(formData.get("issueDate") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    rentAmount: String(formData.get("rentAmount") ?? ""),
    payment: {
      status: String(formData.get("paymentStatus") ?? "UNPAID"),
      amount: String(formData.get("paymentAmount") ?? ""),
      paymentDate: String(formData.get("paymentDate") ?? ""),
      referenceNumber: String(formData.get("referenceNumber") ?? ""),
      notes: String(formData.get("paymentNotes") ?? ""),
    },
    notes: String(formData.get("notes") ?? ""),
    utilityReadings: utilityReadingsResult.rows,
    utilityReadingsParseError: utilityReadingsResult.error,
    recurringChargeIds: recurringChargeIdsResult.rows,
    recurringChargeIdsParseError: recurringChargeIdsResult.error,
    utilityCharges: utilityChargesResult.rows,
    utilityChargesParseError: utilityChargesResult.error,
    adjustments: adjustmentsResult.rows,
    adjustmentsParseError: adjustmentsResult.error,
  };
}

function getHistoricalBacklogBulkPayload(formData: FormData) {
  const rowsResult = parseSerializedRows(
    formData.get("rows"),
    "Bulk backlog rows could not be read. Try again."
  );

  return {
    rows: rowsResult.rows,
    rowsParseError: rowsResult.error,
  };
}

function getHistoricalBacklogParseError(
  payload: ParsedHistoricalBacklogPayload
): HistoricalBacklogFormState | null {
  const errors: HistoricalBacklogFormState["errors"] = {};

  if (payload.utilityReadingsParseError) {
    errors.utilityReadings = [payload.utilityReadingsParseError];
  }

  if (payload.recurringChargeIdsParseError) {
    errors.recurringChargeIds = [payload.recurringChargeIdsParseError];
  }

  if (payload.utilityChargesParseError) {
    errors.utilityCharges = [payload.utilityChargesParseError];
  }

  if (payload.adjustmentsParseError) {
    errors.adjustments = [payload.adjustmentsParseError];
  }

  if (Object.keys(errors).length === 0) {
    return null;
  }

  return {
    errors,
    rowKey: payload.rowKey,
    message: "Backlog rows could not be read. Try again.",
  };
}

function getHistoricalBacklogBulkParseError(
  payload: ParsedHistoricalBacklogBulkPayload
): HistoricalBacklogBulkFormState | null {
  if (!payload.rowsParseError) {
    return null;
  }

  return {
    rowErrors: {
      _form: [payload.rowsParseError],
    },
    message: "Bulk backlog rows could not be read. Try again.",
  };
}

function revalidateBillingViews() {
  [
    "/dashboard",
    "/billing",
    "/billing/backlog",
    "/contracts",
    "/tenants",
    "/utilities",
  ].forEach((path) => revalidatePath(path));
}

function toMoney(value: number) {
  return value.toFixed(2);
}

function startOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getInvoiceStatusFromBalance(balance: number, hasPayments: boolean) {
  if (balance <= 0) {
    return "PAID" as const;
  }

  return hasPayments ? ("PARTIALLY_PAID" as const) : ("ISSUED" as const);
}

function getHistoricalCyclesForContract(contract: BacklogContractRecord) {
  const existingPeriods = new Set(
    contract.invoices.map((invoice) =>
      getBillingCycleKey(invoice.billingPeriodStart, invoice.billingPeriodEnd)
    )
  );
  const existingMonthKeys = new Set(
    contract.invoices.map((invoice) =>
      getBillingMonthKey(invoice.billingPeriodStart)
    )
  );
  const cutoffDate = getHistoricalBacklogCutoffDate();

  return filterCyclesWithoutInvoicedMonths(
    findNextCompletedBillingCycles({
      anchorDate: contract.paymentStartDate,
      contractEndDate: contract.endDate,
      issueDate: getHistoricalBacklogLatestDate(),
      existingPeriods,
    }),
    existingMonthKeys
  ).filter((cycle) => cycle.start <= cutoffDate);
}

function buildPaymentAllocations(
  items: Array<{
    id: string;
    amount: { toString(): string };
  }>,
  requestedAmount: number
) {
  const allocations: Array<{
    invoiceItemId: string;
    amount: number;
  }> = [];
  let remaining = requestedAmount;

  for (const item of items) {
    const amount = Number(item.amount.toString());

    if (amount <= 0 || remaining <= 0) {
      continue;
    }

    const allocatedAmount = Math.min(amount, remaining);
    allocations.push({
      invoiceItemId: item.id,
      amount: allocatedAmount,
    });
    remaining -= allocatedAmount;
  }

  return allocations;
}

function buildRequestedPaymentAmount(
  payment: BacklogPaymentSnapshot,
  totalAmount: number
) {
  if (payment.status === "UNPAID") {
    return 0;
  }

  if (payment.status === "PAID") {
    return totalAmount;
  }

  return Number(payment.amount ?? "0");
}

function getPrismaErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return null;
}

function getPrismaErrorTarget(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "meta" in error &&
    typeof (error as { meta?: unknown }).meta === "object" &&
    (error as { meta?: { target?: unknown } }).meta !== null
  ) {
    const target = (error as { meta?: { target?: unknown } }).meta?.target;

    if (Array.isArray(target)) {
      return target.filter((value): value is string => typeof value === "string");
    }
  }

  return [];
}

function isUniqueConstraintOnFields(error: unknown, fields: string[]) {
  const code = getPrismaErrorCode(error);
  const target = getPrismaErrorTarget(error);

  return code === "P2002" && fields.every((field) => target.includes(field));
}

function getHistoricalBacklogSaveError(error: unknown): HistoricalBacklogFormState {
  if (
    isUniqueConstraintOnFields(error, [
      "contractId",
      "billingPeriodStart",
      "billingPeriodEnd",
    ])
  ) {
    return {
      errors: {
        billingPeriodStart: [
          "This backlog month was already saved for this contract.",
        ],
      },
      message: "Backlog month already exists.",
    };
  }

  if (isUniqueConstraintOnFields(error, ["meterId", "readingDate"])) {
    return {
      errors: {
        utilityReadings: [
          "One or more meter reading dates already exist for the selected meter.",
        ],
      },
      message: "Backlog utility reading dates already exist.",
    };
  }

  if (isUniqueConstraintOnFields(error, ["invoiceNumber"])) {
    return {
      message: "Invoice number collision happened while saving. Try once more.",
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  return {
    message: "Historical month could not be saved. Try again.",
  };
}

function resolveHistoricalCycle(
  contract: BacklogContractRecord,
  cycleStart: Date,
  cycleEnd: Date
) {
  const selectedCycleKey = getBillingCycleKey(cycleStart, cycleEnd);

  return getHistoricalCyclesForContract(contract).find(
    (cycle) => getBillingCycleKey(cycle.start, cycle.end) === selectedCycleKey
  );
}

function getAutoFreeRentConcessionAmount(params: {
  contract: BacklogContractRecord;
  cycleStart: Date;
  rentAmount: number;
}) {
  const { contract, cycleStart, rentAmount } = params;

  if (rentAmount <= 0 || contract.freeRentCycles <= 0) {
    return 0;
  }

  const cycleIndex = getBillingCycleIndex(contract.paymentStartDate, cycleStart);

  if (cycleIndex < 0 || cycleIndex >= contract.freeRentCycles) {
    return 0;
  }

  return rentAmount;
}

function getContractCycleCount(anchorDate: Date, contractEndDate: Date) {
  let count = 0;

  while (count < 240) {
    const cycle = getBillingCycleAtIndex(anchorDate, count);

    if (cycle.start > contractEndDate) {
      break;
    }

    count += 1;
  }

  return count;
}

function getAutoAdvanceRentEffects(params: {
  contract: BacklogContractRecord;
  cycleStart: Date;
  rentAmount: number;
}) {
  const { contract, cycleStart, rentAmount } = params;
  const baseRent = Number(contract.monthlyRent.toString());
  const advanceRentMonths =
    contract.advanceRentMonths > 0
      ? contract.advanceRentMonths
      : deriveWholeMonths(Number(contract.advanceRent.toString()), baseRent);

  if (advanceRentMonths <= 0) {
    return {
      chargeAmount: 0,
      creditAmount: 0,
    };
  }

  const cycleIndex = getBillingCycleIndex(contract.paymentStartDate, cycleStart);

  if (cycleIndex < 0) {
    return {
      chargeAmount: 0,
      creditAmount: 0,
    };
  }

  const totalCycles = getContractCycleCount(
    contract.paymentStartDate,
    contract.endDate
  );
  const advanceApplicationCycleIndexes = buildAdvanceApplicationCycleIndexes({
    totalCycles,
    freeRentCycles: contract.freeRentCycles,
    advanceRentMonths,
    advanceRentApplication: contract.advanceRentApplication,
    advanceRentFirstMonths: contract.advanceRentFirstMonths,
    advanceRentLastMonths: contract.advanceRentLastMonths,
  });
  const isFreeRentCycle = cycleIndex < contract.freeRentCycles;
  const isAdvanceRentApplicationCycle =
    !isFreeRentCycle && advanceApplicationCycleIndexes.has(cycleIndex);

  return {
    chargeAmount: 0,
    creditAmount: isAdvanceRentApplicationCycle ? Math.min(baseRent, rentAmount) : 0,
  };
}

function getApplicableBacklogRecurringCharges(
  contract: BacklogContractRecord,
  cycleStart: Date,
  cycleEnd: Date
) {
  const cycle = {
    start: startOfDay(cycleStart),
    end: endOfDay(cycleEnd),
  };

  return contract.recurringCharges.filter(
    (charge) =>
      charge.isActive &&
      cycleOverlapsRange(cycle, charge.effectiveStartDate, charge.effectiveEndDate)
  );
}

function resolveSelectedBacklogRecurringCharges(params: {
  contract: BacklogContractRecord;
  cycleStart: Date;
  cycleEnd: Date;
  selectedIds: string[];
}) {
  const applicableCharges = getApplicableBacklogRecurringCharges(
    params.contract,
    params.cycleStart,
    params.cycleEnd
  );
  const applicableChargeMap = new Map(
    applicableCharges.map((charge) => [charge.id, charge] as const)
  );
  const invalidIds = [...new Set(params.selectedIds)].filter(
    (chargeId) => !applicableChargeMap.has(chargeId)
  );

  return {
    invalidIds,
    selectedCharges: [...new Set(params.selectedIds)]
      .map((chargeId) => applicableChargeMap.get(chargeId) ?? null)
      .filter(
        (
          charge
        ): charge is (typeof applicableCharges)[number] => charge !== null
      )
      .map((charge) => ({
        id: charge.id,
        label: charge.label,
        amount: Number(charge.amount.toString()),
      })),
  };
}

function formatManualUtilityDescription(params: {
  amount: number;
  note?: string;
  readingMissing?: boolean;
}) {
  const { note, readingMissing } = params;
  const parts = ["Manual utility total"];

  if (readingMissing) {
    parts.push("reading unavailable");
  }

  if (note) {
    parts.push(note);
  }

  return parts.join(" · ");
}

function composeBacklogInvoiceNotes(params: {
  notes?: string;
  readingMissing?: boolean;
  utilityNote?: string;
  freeRentConcessionAmount?: number;
  advanceRentChargeAmount?: number;
  advanceRentCreditAmount?: number;
  bulk?: boolean;
}) {
  const lines: string[] = [];

  if (params.bulk) {
    lines.push("Bulk backlog entry.");
  }

  if (params.readingMissing) {
    lines.push("Historical utility reading unavailable. Manual utility total encoded instead.");
  }

  if ((params.freeRentConcessionAmount ?? 0) > 0) {
    lines.push(
      `Auto free-rent concession applied: ${params.freeRentConcessionAmount?.toFixed(2)}.`
    );
  }

  if ((params.advanceRentCreditAmount ?? 0) > 0) {
    lines.push(
      `Auto advance-rent credit applied: ${params.advanceRentCreditAmount?.toFixed(2)}.`
    );
  }

  if (params.utilityNote) {
    lines.push(`Utility note: ${params.utilityNote}`);
  }

  if (params.notes) {
    lines.push(params.notes);
  }

  return lines.length > 0 ? lines.join("\n") : null;
}

function validateHistoricalReadingRows(params: {
  rows: ParsedHistoricalBacklogPayload["utilityReadings"];
  cycleStart: Date;
  cycleEnd: Date;
  contractTenantId: string;
  allowedMeters: Array<{
    id: string;
    tenantId: string | null;
    propertyId: string;
    isShared: boolean;
    meterCode: string;
    utilityType: keyof typeof UTILITY_TYPE_LABELS;
  }>;
  existingReadings: Array<{
    id: string;
    meterId: string;
    readingDate: Date;
    previousReading: { toString(): string };
    currentReading: { toString(): string };
    ratePerUnit: { toString(): string };
    invoiceItem: {
      id: string;
    } | null;
  }>;
}) {
  const {
    rows,
    cycleStart,
    cycleEnd,
    contractTenantId,
    allowedMeters,
    existingReadings,
  } = params;
  const meterMap = new Map(allowedMeters.map((meter) => [meter.id, meter]));
  const readingsByMeter = new Map<string, MeterTimelineEntry[]>();

  for (const reading of existingReadings) {
    const entries = readingsByMeter.get(reading.meterId) ?? [];
    entries.push({
      id: reading.id,
      readingDate: reading.readingDate,
      previousReading: Number(reading.previousReading.toString()),
      currentReading: Number(reading.currentReading.toString()),
      ratePerUnit: Number(reading.ratePerUnit.toString()),
      invoiceItemId: reading.invoiceItem?.id ?? null,
    });
    readingsByMeter.set(reading.meterId, entries);
  }

  const normalizedRows: CreatedReadingRow[] = [];
  const subsequentUpdates = new Map<
    string,
    {
      previousReading: number;
      consumption: number;
      totalAmount: number;
    }
  >();
  const payloadReadingKeys = new Set<string>();

  const rowsByMeter = new Map<string, typeof rows>();

  for (const row of rows) {
    const entries = rowsByMeter.get(String(row.meterId)) ?? [];
    entries.push(row);
    rowsByMeter.set(String(row.meterId), entries);
  }

  for (const [meterId, meterRows] of rowsByMeter) {
    const meter = meterMap.get(meterId);

    if (!meter || meter.isShared || meter.tenantId !== contractTenantId) {
      return {
        errors: {
          utilityReadings: [
            "One or more selected meters are invalid for this contract.",
          ],
        },
      };
    }

    const timeline = [...(readingsByMeter.get(meterId) ?? [])].sort(
      (left, right) => left.readingDate.getTime() - right.readingDate.getTime()
    );
    const sortedRows = [...meterRows].sort(
      (left, right) =>
        new Date(String(left.readingDate)).getTime() -
        new Date(String(right.readingDate)).getTime()
    );

    for (const row of sortedRows) {
      const readingDate = new Date(String(row.readingDate));
      const payloadKey = `${meterId}:${readingDate.toISOString()}`;

      if (payloadReadingKeys.has(payloadKey)) {
        return {
          errors: {
            utilityReadings: [
              `Duplicate reading date found for meter ${meter.meterCode}.`,
            ],
          },
        };
      }

      payloadReadingKeys.add(payloadKey);

      if (readingDate < cycleStart || readingDate > cycleEnd) {
        return {
          errors: {
            utilityReadings: [
              `Reading dates for ${meter.meterCode} must stay inside selected backlog month.`,
            ],
          },
        };
      }

      const previousEntry =
        [...timeline]
          .reverse()
          .find((entry) => entry.readingDate.getTime() < readingDate.getTime()) ??
        null;
      const nextEntry =
        timeline.find((entry) => entry.readingDate.getTime() > readingDate.getTime()) ??
        null;
      const duplicateEntry = timeline.find(
        (entry) => entry.readingDate.getTime() === readingDate.getTime()
      );

      if (duplicateEntry) {
        return {
          errors: {
            utilityReadings: [
              `Another reading already exists on ${meter.meterCode} for ${toDateInputValue(readingDate)}.`,
            ],
          },
        };
      }

      const expectedPrevious = previousEntry?.currentReading ?? 0;
      const enteredPrevious = Number(String(row.previousReading));
      const currentReading = Number(String(row.currentReading));
      const ratePerUnit = Number(String(row.ratePerUnit));

      if (Math.abs(enteredPrevious - expectedPrevious) > 0.001) {
        return {
          errors: {
            utilityReadings: [
              `Previous reading for ${meter.meterCode} must be ${expectedPrevious.toFixed(2)} on ${toDateInputValue(readingDate)}.`,
            ],
          },
        };
      }

      if (currentReading < expectedPrevious) {
        return {
          errors: {
            utilityReadings: [
              `Current reading for ${meter.meterCode} cannot be lower than ${expectedPrevious.toFixed(2)}.`,
            ],
          },
        };
      }

      if (nextEntry && currentReading > nextEntry.currentReading) {
        return {
          errors: {
            utilityReadings: [
              `Current reading for ${meter.meterCode} cannot exceed later recorded value ${nextEntry.currentReading.toFixed(2)}.`,
            ],
          },
        };
      }

      let runningPreviousValue = currentReading;

      for (const laterEntry of timeline.filter(
        (entry) => entry.readingDate.getTime() > readingDate.getTime()
      )) {
        if (laterEntry.currentReading < runningPreviousValue) {
          return {
            errors: {
              utilityReadings: [
                `Historical insertion for ${meter.meterCode} would break later reading chronology.`,
              ],
            },
          };
        }

        if (
          laterEntry.invoiceItemId &&
          Math.abs(laterEntry.previousReading - runningPreviousValue) > 0.001
        ) {
          return {
            errors: {
              utilityReadings: [
                `Historical insertion for ${meter.meterCode} would change a later billed reading. Encode that month as manual utility charge instead.`,
              ],
            },
          };
        }

        if (!laterEntry.invoiceItemId) {
          laterEntry.previousReading = runningPreviousValue;
          const consumption = laterEntry.currentReading - runningPreviousValue;
          subsequentUpdates.set(laterEntry.id, {
            previousReading: runningPreviousValue,
            consumption,
            totalAmount: consumption * laterEntry.ratePerUnit,
          });
        }

        runningPreviousValue = laterEntry.currentReading;
      }

      const consumption = currentReading - expectedPrevious;
      const totalAmount = consumption * ratePerUnit;

      normalizedRows.push({
        meterId,
        meterCode: meter.meterCode,
        utilityType: meter.utilityType,
        tenantId: contractTenantId,
        readingDate,
        previousReading: expectedPrevious,
        currentReading,
        consumption,
        ratePerUnit,
        totalAmount,
      });

      timeline.push({
        id: `new-${payloadKey}`,
        readingDate,
        previousReading: expectedPrevious,
        currentReading,
        ratePerUnit,
        invoiceItemId: null,
      });
      timeline.sort(
        (left, right) => left.readingDate.getTime() - right.readingDate.getTime()
      );
    }
  }

  return {
    errors: null,
    normalizedRows,
    subsequentUpdates,
  };
}

async function createBacklogInvoiceRecord(params: {
  tx: Prisma.TransactionClient;
  userId: string;
  contract: BacklogContractRecord;
  cycleStart: Date;
  cycleEnd: Date;
  cycleLabel: string;
  issueDate: Date;
  dueDate: Date;
  rentAmount: number;
  recurringCharges?: BacklogRecurringChargeLine[];
  utilityReadings?: CreatedReadingRow[];
  subsequentUpdates?: Map<
    string,
    {
      previousReading: number;
      consumption: number;
      totalAmount: number;
    }
  >;
  manualUtilityAmount?: number;
  utilityNote?: string;
  adjustments?: BacklogAdjustmentLine[];
  autoFreeRentConcessionAmount?: number;
  autoAdvanceRentChargeAmount?: number;
  autoAdvanceRentCreditAmount?: number;
  payment: BacklogPaymentSnapshot;
  notes?: string | null;
  readingMissing?: boolean;
  bulk?: boolean;
}) {
  const {
    tx,
    userId,
    contract,
    cycleStart,
    cycleEnd,
    cycleLabel,
    issueDate,
    dueDate,
    rentAmount,
    recurringCharges = [],
    utilityReadings = [],
    subsequentUpdates = new Map(),
    manualUtilityAmount = 0,
    utilityNote,
    adjustments = [],
    autoFreeRentConcessionAmount = 0,
    autoAdvanceRentChargeAmount = 0,
    autoAdvanceRentCreditAmount = 0,
    payment,
    notes,
    readingMissing,
    bulk,
  } = params;
  const createdReadings = [];

  for (const row of utilityReadings) {
    const reading = await tx.meterReading.create({
      data: {
        meterId: row.meterId,
        tenantId: row.tenantId,
        readingDate: row.readingDate,
        previousReading: toMoney(row.previousReading),
        currentReading: toMoney(row.currentReading),
        consumption: toMoney(row.consumption),
        ratePerUnit: toMoney(row.ratePerUnit),
        totalAmount: toMoney(row.totalAmount),
        origin: "BACKLOG",
        recordedById: userId,
      },
    });

    createdReadings.push({
      ...row,
      id: reading.id,
    });
  }

  for (const [readingId, update] of subsequentUpdates.entries()) {
    await tx.meterReading.update({
      where: { id: readingId },
      data: {
        previousReading: toMoney(update.previousReading),
        consumption: toMoney(update.consumption),
        totalAmount: toMoney(update.totalAmount),
      },
    });
  }

  const utilityReadingAmount = createdReadings.reduce(
    (sum, row) => sum + row.totalAmount,
    0
  );
  const recurringChargeAmount = recurringCharges.reduce(
    (sum, row) => sum + row.amount,
    0
  );
  const adjustmentAmount = adjustments.reduce((sum, row) => sum + row.amount, 0);
  const additionalCharges =
    autoAdvanceRentChargeAmount +
    recurringChargeAmount +
    utilityReadingAmount +
    manualUtilityAmount +
    adjustmentAmount -
    autoFreeRentConcessionAmount -
    autoAdvanceRentCreditAmount;
  const totalAmount = rentAmount + additionalCharges;
  const requestedPaymentAmount = buildRequestedPaymentAmount(payment, totalAmount);

  const invoiceData = {
    contractId: contract.id,
    tenantId: contract.tenantId,
    publicAccessCode: generateInvoiceAccessCode(),
    issueDate,
    dueDate,
    billingPeriodStart: cycleStart,
    billingPeriodEnd: cycleEnd,
    subtotal: toMoney(rentAmount),
    additionalCharges: toMoney(additionalCharges),
    discount: toMoney(0),
    totalAmount: toMoney(totalAmount),
    balanceDue: toMoney(totalAmount),
    origin: "BACKLOG" as const,
    status: getInvoiceStatusFromBalance(totalAmount, false),
    notes: composeBacklogInvoiceNotes({
      notes: notes ?? undefined,
      readingMissing,
      utilityNote,
      freeRentConcessionAmount: autoFreeRentConcessionAmount,
      advanceRentChargeAmount: autoAdvanceRentChargeAmount,
      advanceRentCreditAmount: autoAdvanceRentCreditAmount,
      bulk,
    }),
    items: {
      create: [
        ...(rentAmount > 0
          ? [
              {
                itemType: "RENT" as const,
                description: `Historical rent · ${cycleLabel} · ${contract.property.name}`,
                quantity: toMoney(1),
                unitPrice: toMoney(rentAmount),
                amount: toMoney(rentAmount),
              },
            ]
          : []),
        ...recurringCharges.map((charge) => ({
          itemType: "RECURRING_CHARGE" as const,
          description: `${charge.label} · ${toDateInputValue(cycleStart)} to ${toDateInputValue(cycleEnd)}`,
          quantity: toMoney(1),
          unitPrice: toMoney(charge.amount),
          amount: toMoney(charge.amount),
          contractRecurringChargeId: charge.id,
        })),
        ...createdReadings.map((reading) => ({
          itemType: "UTILITY_READING" as const,
          description: `${UTILITY_TYPE_LABELS[reading.utilityType]} reading · ${reading.meterCode} · ${toDateInputValue(reading.readingDate)}`,
          quantity: toMoney(reading.consumption),
          unitPrice: toMoney(reading.ratePerUnit),
          amount: toMoney(reading.totalAmount),
          meterReadingId: reading.id,
        })),
        ...(manualUtilityAmount > 0
          ? [
              {
                itemType: "UTILITY_READING" as const,
                description: formatManualUtilityDescription({
                  amount: manualUtilityAmount,
                  note: utilityNote,
                  readingMissing,
                }),
                quantity: toMoney(1),
                unitPrice: toMoney(manualUtilityAmount),
                amount: toMoney(manualUtilityAmount),
              },
            ]
          : []),
        ...(autoFreeRentConcessionAmount > 0
          ? [
              {
                itemType: "ADJUSTMENT" as const,
                description: `Free rent concession · ${cycleLabel}`,
                quantity: toMoney(1),
                unitPrice: toMoney(-autoFreeRentConcessionAmount),
                amount: toMoney(-autoFreeRentConcessionAmount),
              },
            ]
          : []),
        ...(autoAdvanceRentCreditAmount > 0
          ? [
              {
                itemType: "ADJUSTMENT" as const,
                description: `Advance rent applied · ${cycleLabel}`,
                quantity: toMoney(1),
                unitPrice: toMoney(-autoAdvanceRentCreditAmount),
                amount: toMoney(-autoAdvanceRentCreditAmount),
              },
            ]
          : []),
        ...adjustments.map((adjustment) => ({
          itemType: adjustment.itemType,
          description: adjustment.label,
          quantity: toMoney(1),
          unitPrice: toMoney(adjustment.amount),
          amount: toMoney(adjustment.amount),
        })),
      ],
    },
  };

  let invoice: {
    id: string;
    items: Array<{
      id: string;
      amount: { toString(): string };
    }>;
  } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      invoice = await tx.invoice.create({
        data: {
          invoiceNumber: buildInvoiceNumber(issueDate, contract.property.propertyCode),
          ...invoiceData,
        },
        include: {
          items: {
            orderBy: [{ createdAt: "asc" }],
            select: {
              id: true,
              amount: true,
            },
          },
        },
      });
      break;
    } catch (error) {
      if (isUniqueConstraintOnFields(error, ["invoiceNumber"]) && attempt < 2) {
        continue;
      }

      throw error;
    }
  }

  if (!invoice) {
    throw new Error("Invoice could not be created.");
  }

  if (requestedPaymentAmount > totalAmount + 0.001) {
    throw new Error("Payment amount cannot exceed the backlog invoice total.");
  }

  if (requestedPaymentAmount > 0) {
    const allocations = buildPaymentAllocations(invoice.items, requestedPaymentAmount);
    const allocatedTotal = allocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0
    );
    const nextBalance = Math.max(0, totalAmount - allocatedTotal);

    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        contractId: contract.id,
        amountPaid: toMoney(allocatedTotal),
        dueDate,
        paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : issueDate,
        status: "SETTLED",
        referenceNumber: payment.referenceNumber ?? null,
        notes: payment.notes ?? null,
        allocations: {
          create: allocations.map((allocation) => ({
            invoiceItemId: allocation.invoiceItemId,
            amountAllocated: toMoney(allocation.amount),
          })),
        },
      },
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        balanceDue: toMoney(nextBalance),
        status: getInvoiceStatusFromBalance(nextBalance, true),
      },
    });
  }

  return invoice.id;
}

async function getBacklogContractsByIds(contractIds: string[]) {
  const cutoffDate = getHistoricalBacklogCutoffDate();

  return prisma.contract.findMany({
    where: {
      id: {
        in: contractIds,
      },
      paymentStartDate: {
        lt: cutoffDate,
      },
    },
    select: {
      id: true,
      tenantId: true,
      paymentStartDate: true,
      endDate: true,
      monthlyRent: true,
      freeRentCycles: true,
      advanceRentMonths: true,
      advanceRentApplication: true,
      advanceRentFirstMonths: true,
      advanceRentLastMonths: true,
      advanceRent: true,
      recurringCharges: {
        select: {
          id: true,
          chargeType: true,
          label: true,
          amount: true,
          effectiveStartDate: true,
          effectiveEndDate: true,
          isActive: true,
        },
      },
      property: {
        select: {
          id: true,
          name: true,
          propertyCode: true,
        },
      },
      invoices: {
        where: {
          billingPeriodStart: {
            lt: cutoffDate,
          },
        },
        select: {
          billingPeriodStart: true,
          billingPeriodEnd: true,
        },
      },
    },
  });
}

function flattenHistoricalBacklogErrors(
  errors: HistoricalBacklogFormState["errors"]
) {
  return Object.values(errors ?? {}).flatMap((messages) => messages ?? []);
}

async function saveHistoricalBacklogMonth(params: {
  userId: string;
  input: HistoricalBacklogInput;
  contract: BacklogContractRecord;
  rowKey?: string;
  bulk?: boolean;
}) {
  const { userId, input, contract, rowKey, bulk } = params;
  const cycleStart = startOfDay(new Date(input.billingPeriodStart));
  const cycleEnd = endOfDay(new Date(input.billingPeriodEnd));
  const issueDate = endOfDay(new Date(input.issueDate));
  const dueDate = endOfDay(new Date(input.dueDate));
  const cutoffDate = getHistoricalBacklogCutoffDate();

  if (cycleStart > cutoffDate) {
    return {
      ok: false as const,
      state: {
        rowKey,
        refreshRequired: true,
        errors: {
          billingPeriodStart: [
            "Historical backlog months must stay on or before final transition month.",
          ],
        },
        message: "Selected month is outside historical backlog window.",
      },
    };
  }

  const matchedCycle = resolveHistoricalCycle(contract, cycleStart, cycleEnd);

  if (!matchedCycle) {
    return {
      ok: false as const,
      state: {
        rowKey,
        refreshRequired: true,
        errors: {
          billingPeriodStart: [
            "Selected month is no longer available for manual historical encoding.",
          ],
        },
        message: "Backlog month selection out of date.",
      },
    };
  }

  const rentAmount = input.rentAmount ? Number(input.rentAmount) : 0;
  const recurringChargeSelection = resolveSelectedBacklogRecurringCharges({
    contract,
    cycleStart,
    cycleEnd,
    selectedIds: input.recurringChargeIds,
  });

  if (recurringChargeSelection.invalidIds.length > 0) {
    return {
      ok: false as const,
      state: {
        rowKey,
        refreshRequired: true,
        errors: {
          recurringChargeIds: [
            "One or more recurring charge selections are no longer valid for this month.",
          ],
        },
        message: "Recurring charge selection is out of date.",
      },
    };
  }

  const recurringChargeAmount = recurringChargeSelection.selectedCharges.reduce(
    (sum, charge) => sum + charge.amount,
    0
  );
  const autoFreeRentConcessionAmount = getAutoFreeRentConcessionAmount({
    contract,
    cycleStart,
    rentAmount,
  });
  const autoAdvanceRentEffects = getAutoAdvanceRentEffects({
    contract,
    cycleStart,
    rentAmount,
  });

  if (
    rentAmount <= 0 &&
    recurringChargeSelection.selectedCharges.length === 0 &&
    input.utilityReadings.length === 0 &&
    input.utilityCharges.length === 0 &&
    input.adjustments.length === 0
  ) {
    return {
      ok: false as const,
      state: {
        rowKey,
        errors: {
          rentAmount: ["Add at least one monetary line before saving."],
        },
        message: "Backlog month needs at least one billable line.",
      },
    };
  }

  const selectedMeterIds = [...new Set(input.utilityReadings.map((row) => row.meterId))];
  const allowedMeters = selectedMeterIds.length
    ? await prisma.utilityMeter.findMany({
        where: {
          id: {
            in: selectedMeterIds,
          },
        },
        select: {
          id: true,
          tenantId: true,
          propertyId: true,
          isShared: true,
          meterCode: true,
          utilityType: true,
        },
      })
    : [];
  const existingReadings = selectedMeterIds.length
    ? await prisma.meterReading.findMany({
        where: {
          meterId: {
            in: selectedMeterIds,
          },
        },
        orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          meterId: true,
          readingDate: true,
          previousReading: true,
          currentReading: true,
          ratePerUnit: true,
          invoiceItem: {
            select: {
              id: true,
            },
          },
        },
      })
    : [];

  if (
    allowedMeters.some(
      (meter) =>
        meter.propertyId !== contract.property.id ||
        meter.tenantId !== contract.tenantId ||
        meter.isShared
    )
  ) {
    return {
      ok: false as const,
      state: {
        rowKey,
        errors: {
          utilityReadings: [
            "Backlog utility readings must use dedicated meters on this contract.",
          ],
        },
        message: "One or more selected meters invalid.",
      },
    };
  }

  const readingValidation = validateHistoricalReadingRows({
    rows: input.utilityReadings,
    cycleStart,
    cycleEnd,
    contractTenantId: contract.tenantId,
    allowedMeters,
    existingReadings,
  });

  if (readingValidation.errors) {
    return {
      ok: false as const,
      state: {
        rowKey,
        errors: readingValidation.errors,
        message: "Historical utility readings invalid.",
      },
    };
  }

  const manualUtilityAmount = input.utilityCharges.reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );
  const adjustmentLines: BacklogAdjustmentLine[] = input.adjustments.map((row) => ({
    itemType: row.itemType,
    label: row.label,
    amount: Number(row.amount),
  }));
  const totalAmount =
    rentAmount +
    autoAdvanceRentEffects.chargeAmount +
    recurringChargeAmount +
    manualUtilityAmount +
    readingValidation.normalizedRows.reduce((sum, row) => sum + row.totalAmount, 0) +
    adjustmentLines.reduce((sum, row) => sum + row.amount, 0) -
    autoFreeRentConcessionAmount -
    autoAdvanceRentEffects.creditAmount;

  if (totalAmount < 0) {
    return {
      ok: false as const,
      state: {
        rowKey,
        errors: {
          adjustments: [
            "Backlog invoice total cannot go negative after credits and adjustments.",
          ],
        },
        message: "Backlog invoice total invalid.",
      },
    };
  }

  try {
    const invoiceId = await prisma.$transaction(async (tx) =>
      createBacklogInvoiceRecord({
        tx,
        userId,
        contract,
        cycleStart,
        cycleEnd,
        cycleLabel: formatBillingCycleLabel(matchedCycle),
        issueDate,
        dueDate,
        rentAmount,
        recurringCharges: recurringChargeSelection.selectedCharges,
        utilityReadings: readingValidation.normalizedRows,
        subsequentUpdates: readingValidation.subsequentUpdates,
        manualUtilityAmount,
        utilityNote:
          input.utilityCharges.length > 0
            ? input.utilityCharges
                .map((row) =>
                  row.label
                    ? `${UTILITY_TYPE_LABELS[row.utilityType]}: ${row.label}`
                    : UTILITY_TYPE_LABELS[row.utilityType]
                )
                .join(" | ")
            : undefined,
        adjustments: adjustmentLines,
        autoFreeRentConcessionAmount,
        autoAdvanceRentChargeAmount: autoAdvanceRentEffects.chargeAmount,
        autoAdvanceRentCreditAmount: autoAdvanceRentEffects.creditAmount,
        payment: input.payment,
        notes: input.notes ?? null,
        bulk,
      })
    );

    return {
      ok: true as const,
      invoiceId,
      cycleLabel: formatBillingCycleLabel(matchedCycle),
    };
  } catch (error) {
    return {
      ok: false as const,
      state: {
        ...getHistoricalBacklogSaveError(error),
        rowKey,
      },
    };
  }
}

export async function createHistoricalBacklogAction(
  _previousState: HistoricalBacklogFormState,
  formData: FormData
): Promise<HistoricalBacklogFormState> {
  const user = await requireRole("ADMIN");
  const payload = getHistoricalBacklogPayload(formData);
  const parseError = getHistoricalBacklogParseError(payload);

  if (parseError) {
    return parseError;
  }

  const validatedFields = historicalBacklogSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      rowKey: payload.rowKey,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix highlighted backlog fields, then try again.",
    };
  }

  const [contract] = await getBacklogContractsByIds([validatedFields.data.contractId]);

  if (!contract) {
    return {
      rowKey: payload.rowKey,
      refreshRequired: true,
      errors: {
        contractId: ["Select valid contract."],
      },
      message: "Backlog contract selection invalid.",
    };
  }
  const result = await saveHistoricalBacklogMonth({
    userId: user.id,
    input: validatedFields.data,
    contract,
    rowKey: payload.rowKey,
  });

  if (!result.ok) {
    return result.state;
  }

  revalidateBillingViews();
  redirect(
    withToast(`/billing/${result.invoiceId}`, {
      intent: "success",
      title: "Backlog month saved",
      description: `Saved historical invoice for ${result.cycleLabel}.`,
    })
  );
}

export async function createHistoricalBacklogBulkAction(
  _previousState: HistoricalBacklogBulkFormState,
  formData: FormData
): Promise<HistoricalBacklogBulkFormState> {
  const user = await requireRole("ADMIN");
  const payload = getHistoricalBacklogBulkPayload(formData);
  const parseError = getHistoricalBacklogBulkParseError(payload);

  if (parseError) {
    return parseError;
  }

  if (payload.rows.length === 0) {
    return {
      rowErrors: {
        _form: ["No bulk backlog rows available to save."],
      },
      message: "Nothing to save.",
    };
  }

  const contracts = await getBacklogContractsByIds([
    ...new Set(
      payload.rows
        .map((row) =>
          row && typeof row === "object" && "contractId" in row
            ? String(row.contractId)
            : ""
        )
        .filter(Boolean)
    ),
  ]);
  const contractMap = new Map(contracts.map((contract) => [contract.id, contract]));
  const rowErrors: Record<string, string[]> = {};
  const savedRowKeys: string[] = [];
  const savedRows: HistoricalBacklogBulkFormState["savedRows"] = [];
  let refreshRequired = false;

  for (const rawRow of payload.rows) {
    const parsedRow = backlogBulkRowSchema.safeParse(rawRow);

    if (!parsedRow.success) {
      const fallbackRowKey =
        rawRow && typeof rawRow === "object" && "rowKey" in rawRow
          ? String(rawRow.rowKey)
          : `row-${Object.keys(rowErrors).length + 1}`;
      rowErrors[fallbackRowKey] = parsedRow.error.issues.map(
        (issue) => issue.message
      );
      continue;
    }

    const row: HistoricalBacklogBulkRowInput = parsedRow.data;
    const contract = contractMap.get(row.contractId);

    if (!contract) {
      rowErrors[row.rowKey] = [
        "Contract is no longer valid for historical backlog entry.",
      ];
      refreshRequired = true;
      continue;
    }

    const { rowKey, ...monthInput } = row;
    const result = await saveHistoricalBacklogMonth({
      userId: user.id,
      input: monthInput,
      contract,
      rowKey,
      bulk: true,
    });

    if (!result.ok) {
      refreshRequired ||= Boolean(result.state.refreshRequired);
      const flattenedErrors = flattenHistoricalBacklogErrors(result.state.errors);
      rowErrors[row.rowKey] =
        flattenedErrors.length > 0
          ? flattenedErrors
          : [result.state.message ?? "Row could not be saved."];
      continue;
    }

    savedRowKeys.push(row.rowKey);
    savedRows.push({
      rowKey: row.rowKey,
      invoiceId: result.invoiceId,
    });
  }

  if (savedRowKeys.length > 0) {
    revalidateBillingViews();
  }

  const failedCount = Object.keys(rowErrors).filter((key) => key !== "_form").length;

  return {
    savedRowKeys,
    savedRows,
    rowErrors,
    refreshRequired,
    message:
      savedRowKeys.length > 0
        ? failedCount > 0
          ? `Saved ${savedRowKeys.length} backlog row(s). ${failedCount} row(s) still need fixes.`
          : `Saved ${savedRowKeys.length} backlog row(s).`
        : "No backlog rows were saved.",
  };
}
