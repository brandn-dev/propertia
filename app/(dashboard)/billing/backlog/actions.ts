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
} from "@/lib/billing/cycles";
import { buildInvoiceNumber } from "@/lib/billing/invoice-number";
import { generateInvoiceAccessCode } from "@/lib/billing/public-access";
import { UTILITY_TYPE_LABELS } from "@/lib/form-options";
import { toDateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { withToast } from "@/lib/toast";
import {
  backlogBulkRowSchema,
  historicalBacklogSchema,
  type HistoricalBacklogBulkRowInput,
} from "@/lib/validations/historical-backlog";

export type HistoricalBacklogFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type HistoricalBacklogBulkFormState = {
  message?: string;
  rowErrors?: Record<string, string[] | undefined>;
  savedRowKeys?: string[];
  savedRows?: Array<{
    rowKey: string;
    invoiceId: string;
  }>;
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
  advanceRentApplication: "FIRST_BILLABLE_CYCLES" | "LAST_BILLABLE_CYCLES";
  advanceRent: { toString(): string };
  property: {
    id: string;
    name: string;
    propertyCode: string;
  };
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
  const utilityChargesResult = parseSerializedRows(
    formData.get("utilityCharges"),
    "Utility charge rows could not be read. Try again."
  );
  const adjustmentsResult = parseSerializedRows(
    formData.get("adjustments"),
    "Adjustment rows could not be read. Try again."
  );

  return {
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

function deriveWholeMonths(amount: number, baseRent: number) {
  if (amount <= 0 || baseRent <= 0) {
    return 0;
  }

  const ratio = amount / baseRent;
  const rounded = Math.round(ratio);

  return Math.abs(ratio - rounded) < 0.01 ? rounded : 0;
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

function buildAdvanceApplicationCycleIndexes(params: {
  totalCycles: number;
  freeRentCycles: number;
  advanceRentMonths: number;
  application: "FIRST_BILLABLE_CYCLES" | "LAST_BILLABLE_CYCLES";
}) {
  const { totalCycles, freeRentCycles, advanceRentMonths, application } = params;
  const billableCycleIndexes = Array.from({ length: totalCycles }, (_, index) => index)
    .filter((index) => index >= freeRentCycles);

  const selectedIndexes =
    application === "LAST_BILLABLE_CYCLES"
      ? billableCycleIndexes.slice(-advanceRentMonths)
      : billableCycleIndexes.slice(0, advanceRentMonths);

  return new Set(selectedIndexes);
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
    application: contract.advanceRentApplication,
  });
  const isFreeRentCycle = cycleIndex < contract.freeRentCycles;
  const isAdvanceRentApplicationCycle =
    !isFreeRentCycle && advanceApplicationCycleIndexes.has(cycleIndex);

  return {
    chargeAmount: 0,
    creditAmount: isAdvanceRentApplicationCycle ? Math.min(baseRent, rentAmount) : 0,
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
  const adjustmentAmount = adjustments.reduce((sum, row) => sum + row.amount, 0);
  const additionalCharges =
    autoAdvanceRentChargeAmount +
    utilityReadingAmount +
    manualUtilityAmount +
    adjustmentAmount -
    autoFreeRentConcessionAmount -
    autoAdvanceRentCreditAmount;
  const totalAmount = rentAmount + additionalCharges;
  const requestedPaymentAmount = buildRequestedPaymentAmount(payment, totalAmount);

  const invoice = await tx.invoice.create({
    data: {
      invoiceNumber: buildInvoiceNumber(issueDate, contract.property.propertyCode),
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
      origin: "BACKLOG",
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
      advanceRent: true,
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
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix highlighted backlog fields, then try again.",
    };
  }

  const cycleStart = startOfDay(new Date(validatedFields.data.billingPeriodStart));
  const cycleEnd = endOfDay(new Date(validatedFields.data.billingPeriodEnd));
  const issueDate = endOfDay(new Date(validatedFields.data.issueDate));
  const dueDate = endOfDay(new Date(validatedFields.data.dueDate));
  const cutoffDate = getHistoricalBacklogCutoffDate();

  if (cycleStart > cutoffDate) {
    return {
      errors: {
        billingPeriodStart: [
          "Historical backlog months must stay on or before final transition month.",
        ],
      },
      message: "Selected month is outside historical backlog window.",
    };
  }

  const [contract] = await getBacklogContractsByIds([validatedFields.data.contractId]);

  if (!contract) {
    return {
      errors: {
        contractId: ["Select valid contract."],
      },
      message: "Backlog contract selection invalid.",
    };
  }

  const matchedCycle = resolveHistoricalCycle(contract, cycleStart, cycleEnd);

  if (!matchedCycle) {
    return {
      errors: {
        billingPeriodStart: [
          "Selected month is no longer available for manual historical encoding.",
        ],
      },
      message: "Backlog month selection out of date.",
    };
  }

  const rentAmount = validatedFields.data.rentAmount
    ? Number(validatedFields.data.rentAmount)
    : 0;
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
    validatedFields.data.utilityReadings.length === 0 &&
    validatedFields.data.utilityCharges.length === 0 &&
    validatedFields.data.adjustments.length === 0
  ) {
    return {
      errors: {
        rentAmount: ["Add at least one monetary line before saving."],
      },
      message: "Backlog month needs at least one billable line.",
    };
  }

  const selectedMeterIds = [
    ...new Set(validatedFields.data.utilityReadings.map((row) => row.meterId)),
  ];
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
      errors: {
        utilityReadings: [
          "Backlog utility readings must use dedicated meters on this contract.",
        ],
      },
      message: "One or more selected meters invalid.",
    };
  }

  const readingValidation = validateHistoricalReadingRows({
    rows: validatedFields.data.utilityReadings,
    cycleStart,
    cycleEnd,
    contractTenantId: contract.tenantId,
    allowedMeters,
    existingReadings,
  });

  if (readingValidation.errors) {
    return {
      errors: readingValidation.errors,
      message: "Historical utility readings invalid.",
    };
  }

  const manualUtilityAmount = validatedFields.data.utilityCharges.reduce(
    (sum, row) => sum + Number(row.amount),
    0
  );
  const adjustmentLines: BacklogAdjustmentLine[] = validatedFields.data.adjustments.map(
    (row) => ({
      itemType: row.itemType,
      label: row.label,
      amount: Number(row.amount),
    })
  );
  const totalAmount =
    rentAmount +
    autoAdvanceRentEffects.chargeAmount +
    manualUtilityAmount +
    readingValidation.normalizedRows.reduce((sum, row) => sum + row.totalAmount, 0) +
    adjustmentLines.reduce((sum, row) => sum + row.amount, 0) -
    autoFreeRentConcessionAmount -
    autoAdvanceRentEffects.creditAmount;

  if (totalAmount < 0) {
    return {
      errors: {
        adjustments: [
          "Backlog invoice total cannot go negative after credits and adjustments.",
        ],
      },
      message: "Backlog invoice total invalid.",
    };
  }

  try {
    const invoiceId = await prisma.$transaction(async (tx) =>
      createBacklogInvoiceRecord({
        tx,
        userId: user.id,
        contract,
        cycleStart,
        cycleEnd,
        cycleLabel: formatBillingCycleLabel(matchedCycle),
        issueDate,
        dueDate,
        rentAmount,
        utilityReadings: readingValidation.normalizedRows,
        subsequentUpdates: readingValidation.subsequentUpdates,
        manualUtilityAmount,
        utilityNote:
          validatedFields.data.utilityCharges.length > 0
            ? validatedFields.data.utilityCharges
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
        payment: validatedFields.data.payment,
        notes: validatedFields.data.notes ?? null,
      })
    );

    revalidateBillingViews();
    redirect(
      withToast(`/billing/${invoiceId}`, {
        intent: "success",
        title: "Backlog month saved",
        description: `Saved historical invoice for ${formatBillingCycleLabel(matchedCycle)}.`,
      })
    );
  } catch {
    return {
      message:
        "Historical month could not be saved. Check duplicate months or reading dates, then try again.",
    };
  }
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
      continue;
    }

    const cycleStart = startOfDay(new Date(row.billingPeriodStart));
    const cycleEnd = endOfDay(new Date(row.billingPeriodEnd));
    const issueDate = endOfDay(new Date(row.issueDate));
    const dueDate = endOfDay(new Date(row.dueDate));
    const cutoffDate = getHistoricalBacklogCutoffDate();

    if (cycleStart > cutoffDate) {
      rowErrors[row.rowKey] = [
        "Month is outside historical backlog window.",
      ];
      continue;
    }

    const matchedCycle = resolveHistoricalCycle(contract, cycleStart, cycleEnd);

    if (!matchedCycle) {
      rowErrors[row.rowKey] = [
        "Month is no longer available for manual historical encoding.",
      ];
      continue;
    }

    const rentAmount = row.rentAmount ? Number(row.rentAmount) : 0;
    const manualUtilityAmount = row.manualUtilityAmount
      ? Number(row.manualUtilityAmount)
      : 0;
    const cycleLabel = formatBillingCycleLabel(matchedCycle);
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
    const adjustmentLines: BacklogAdjustmentLine[] = [];

    if (row.adjustmentAmount && Number(row.adjustmentAmount) !== 0) {
      adjustmentLines.push({
        itemType: "ADJUSTMENT",
        label: `Bulk adjustment · ${cycleLabel}`,
        amount: Number(row.adjustmentAmount),
      });
    }

    if (row.arrearsAmount && Number(row.arrearsAmount) !== 0) {
      adjustmentLines.push({
        itemType: "ARREARS",
        label: `Prior arrears · ${cycleLabel}`,
        amount: Number(row.arrearsAmount),
      });
    }

    const totalAmount =
      rentAmount +
      autoAdvanceRentEffects.chargeAmount +
      manualUtilityAmount +
      adjustmentLines.reduce((sum, item) => sum + item.amount, 0) -
      autoFreeRentConcessionAmount -
      autoAdvanceRentEffects.creditAmount;

    if (
      rentAmount <= 0 &&
      manualUtilityAmount <= 0 &&
      adjustmentLines.length === 0
    ) {
      rowErrors[row.rowKey] = ["Row needs at least one billable amount."];
      continue;
    }

    if (totalAmount < 0) {
      rowErrors[row.rowKey] = [
        "Invoice total cannot go negative after adjustments and free-rent credits.",
      ];
      continue;
    }

    const requestedPaymentAmount = buildRequestedPaymentAmount(
      {
        status: row.paymentStatus,
        amount: row.paymentAmount,
        paymentDate: row.paymentDate,
        referenceNumber: row.referenceNumber,
        notes: undefined,
      },
      totalAmount
    );

    if (requestedPaymentAmount > totalAmount + 0.001) {
      rowErrors[row.rowKey] = ["Payment amount cannot exceed invoice total."];
      continue;
    }

    try {
      const invoiceId = await prisma.$transaction(async (tx) =>
        createBacklogInvoiceRecord({
          tx,
          userId: user.id,
          contract,
          cycleStart,
          cycleEnd,
          cycleLabel,
          issueDate,
          dueDate,
          rentAmount,
          manualUtilityAmount,
          utilityNote: row.utilityNote,
          adjustments: adjustmentLines,
          autoFreeRentConcessionAmount,
          autoAdvanceRentChargeAmount: autoAdvanceRentEffects.chargeAmount,
          autoAdvanceRentCreditAmount: autoAdvanceRentEffects.creditAmount,
          payment: {
            status: row.paymentStatus,
            amount: row.paymentAmount,
            paymentDate: row.paymentDate,
            referenceNumber: row.referenceNumber,
          },
          notes: row.notes ?? null,
          readingMissing: row.readingMissing,
          bulk: true,
        })
      );
      savedRowKeys.push(row.rowKey);
      savedRows.push({
        rowKey: row.rowKey,
        invoiceId,
      });
    } catch {
      rowErrors[row.rowKey] = [
        "Row could not be saved. Check duplicate invoice month or invalid amounts.",
      ];
    }
  }

  if (savedRowKeys.length > 0) {
    revalidateBillingViews();
  }

  const failedCount = Object.keys(rowErrors).filter((key) => key !== "_form").length;

  return {
    savedRowKeys,
    savedRows,
    rowErrors,
    message:
      savedRowKeys.length > 0
        ? failedCount > 0
          ? `Saved ${savedRowKeys.length} backlog row(s). ${failedCount} row(s) still need fixes.`
          : `Saved ${savedRowKeys.length} backlog row(s).`
        : "No backlog rows were saved.",
  };
}
