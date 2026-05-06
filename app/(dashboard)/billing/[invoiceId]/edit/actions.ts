"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import {
  formatBillingCycleLabel,
  getBillingCycleAtIndex,
  getBillingCycleIndex,
} from "@/lib/billing/cycles";
import { UTILITY_TYPE_LABELS } from "@/lib/form-options";
import { toDateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { withToast } from "@/lib/toast";

export type BacklogInvoiceEditFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

type ParsedEditableItem = {
  id: string;
  itemType: string;
  description: string;
  amount: string;
  mode: "manual" | "meter";
  isNew?: boolean;
  meterId?: string;
  meterReadingId?: string;
  readingDate?: string;
  previousReading?: string;
  currentReading?: string;
  ratePerUnit?: string;
};

type TimelineReading = {
  id: string;
  readingDate: Date;
  currentReading: { toString(): string };
  ratePerUnit: { toString(): string };
  invoiceItem: { id: string } | null;
};

type AllowedMeter = {
  id: string;
  tenantId: string | null;
  propertyId: string;
  isShared: boolean;
  meterCode: string;
  utilityType: keyof typeof UTILITY_TYPE_LABELS;
};

type PendingCreatedReading = {
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

type AutoManagedContract = {
  paymentStartDate: Date;
  endDate: Date;
  monthlyRent: { toString(): string };
  freeRentCycles: number;
  advanceRentMonths: number;
  advanceRentApplication: "FIRST_BILLABLE_CYCLES" | "LAST_BILLABLE_CYCLES";
  advanceRent: { toString(): string };
};

class BacklogEditValidationError extends Error {
  errors?: Record<string, string[] | undefined>;

  constructor(message: string, errors?: Record<string, string[] | undefined>) {
    super(message);
    this.name = "BacklogEditValidationError";
    this.errors = errors;
  }
}

const AUTO_FREE_RENT_PREFIX = "Free rent concession · ";
const AUTO_ADVANCE_RENT_CHARGE_PREFIX = "Advance rent charge · ";
const AUTO_ADVANCE_RENT_CREDIT_PREFIX = "Advance rent applied · ";

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

function isAutoManagedBacklogLine(itemType: string, description: string) {
  if (itemType !== "ADJUSTMENT") {
    return false;
  }

  return (
    description.startsWith(AUTO_FREE_RENT_PREFIX) ||
    description.startsWith(AUTO_ADVANCE_RENT_CHARGE_PREFIX) ||
    description.startsWith(AUTO_ADVANCE_RENT_CREDIT_PREFIX)
  );
}

function deriveWholeMonths(amount: number, baseRent: number) {
  if (baseRent <= 0 || amount <= 0) {
    return 0;
  }

  return Math.max(0, Math.round(amount / baseRent));
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
  const billableCycleIndexes = Array.from({ length: totalCycles }, (_, index) => index).filter(
    (index) => index >= freeRentCycles
  );
  const selectedIndexes =
    application === "LAST_BILLABLE_CYCLES"
      ? billableCycleIndexes.slice(-advanceRentMonths)
      : billableCycleIndexes.slice(0, advanceRentMonths);

  return new Set(selectedIndexes);
}

function getAutoFreeRentConcessionAmount(params: {
  contract: AutoManagedContract;
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

function getAutoAdvanceRentEffects(params: {
  contract: AutoManagedContract;
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

function syncAutoManagedNotes(
  notes: string | null,
  amounts: {
    freeRentConcessionAmount: number;
    advanceRentChargeAmount: number;
    advanceRentCreditAmount: number;
  }
) {
  const baseLines = (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter(
      (line) =>
        !line.startsWith("Auto free-rent concession applied:") &&
        !line.startsWith("Auto advance-rent charge applied:") &&
        !line.startsWith("Auto advance-rent credit applied:")
    );

  if (amounts.freeRentConcessionAmount > 0) {
    baseLines.push(
      `Auto free-rent concession applied: ${amounts.freeRentConcessionAmount.toFixed(2)}.`
    );
  }

  if (amounts.advanceRentCreditAmount > 0) {
    baseLines.push(
      `Auto advance-rent credit applied: ${amounts.advanceRentCreditAmount.toFixed(2)}.`
    );
  }

  return baseLines.length > 0 ? baseLines.join("\n") : null;
}

function parseEditableItems(rawValue: FormDataEntryValue | null) {
  const raw = String(rawValue ?? "").trim();

  if (!raw) {
    return {
      items: [],
      error: "Invoice items could not be read. Try again.",
    };
  }

  try {
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return {
        items: [],
        error: "Invoice items could not be read. Try again.",
      };
    }

    return {
      items: parsed,
      error: null,
    };
  } catch {
    return {
      items: [],
      error: "Invoice items could not be read. Try again.",
    };
  }
}

function findPreviousReading(readings: TimelineReading[], readingDate: Date) {
  const timestamp = readingDate.getTime();

  return (
    [...readings]
      .reverse()
      .find((reading) => reading.readingDate.getTime() < timestamp) ?? null
  );
}

function findNextReading(readings: TimelineReading[], readingDate: Date) {
  const timestamp = readingDate.getTime();

  return (
    readings.find((reading) => reading.readingDate.getTime() > timestamp) ?? null
  );
}

function buildMeterReadingDescription(params: {
  utilityType: keyof typeof UTILITY_TYPE_LABELS;
  meterCode: string;
  readingDate: Date;
}) {
  return `${UTILITY_TYPE_LABELS[params.utilityType]} reading · ${params.meterCode} · ${toDateInputValue(params.readingDate)}`;
}

function validateNewMeterItems(params: {
  items: ParsedEditableItem[];
  cycleStart: Date;
  cycleEnd: Date;
  contractTenantId: string;
  allowedMeters: AllowedMeter[];
  existingReadings: Array<{
    id: string;
    meterId: string;
    readingDate: Date;
    previousReading: { toString(): string };
    currentReading: { toString(): string };
    ratePerUnit: { toString(): string };
    invoiceItem: { id: string } | null;
  }>;
}) {
  const meterMap = new Map(
    params.allowedMeters.map((meter) => [meter.id, meter] as const)
  );
  const readingsByMeter = new Map<string, TimelineReading[]>();

  for (const reading of params.existingReadings) {
    const entries = readingsByMeter.get(reading.meterId) ?? [];
    entries.push({
      id: reading.id,
      readingDate: reading.readingDate,
      currentReading: reading.currentReading,
      ratePerUnit: reading.ratePerUnit,
      invoiceItem: reading.invoiceItem,
    });
    readingsByMeter.set(reading.meterId, entries);
  }

  const rowsByMeter = new Map<string, ParsedEditableItem[]>();

  for (const item of params.items) {
    const meterId = item.meterId ?? "";
    const rows = rowsByMeter.get(meterId) ?? [];
    rows.push(item);
    rowsByMeter.set(meterId, rows);
  }

  const payloadReadingKeys = new Set<string>();
  const normalizedRows: PendingCreatedReading[] = [];
  const subsequentUpdates = new Map<
    string,
    {
      previousReading: number;
      consumption: number;
      totalAmount: number;
    }
  >();

  for (const [meterId, meterRows] of rowsByMeter) {
    const meter = meterMap.get(meterId);

    if (!meter || meter.isShared || meter.tenantId !== params.contractTenantId) {
      return {
        errors: ["One or more selected meters are invalid for this backlog invoice."],
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

    for (const item of sortedRows) {
      const readingDate = new Date(String(item.readingDate));
      const payloadKey = `${meterId}:${readingDate.toISOString()}`;

      if (payloadReadingKeys.has(payloadKey)) {
        return {
          errors: [`Duplicate reading date found for meter ${meter.meterCode}.`],
        };
      }

      payloadReadingKeys.add(payloadKey);

      if (readingDate < params.cycleStart || readingDate > params.cycleEnd) {
        return {
          errors: [
            `Reading dates for ${meter.meterCode} must stay inside the backlog invoice month.`,
          ],
        };
      }

      const previousEntry = findPreviousReading(timeline, readingDate);
      const nextEntry = findNextReading(timeline, readingDate);
      const duplicateEntry = timeline.find(
        (entry) => entry.readingDate.getTime() === readingDate.getTime()
      );

      if (duplicateEntry) {
        return {
          errors: [
            `Another reading already exists on ${meter.meterCode} for ${toDateInputValue(readingDate)}.`,
          ],
        };
      }

      const expectedPrevious = previousEntry
        ? Number(previousEntry.currentReading.toString())
        : 0;
      const enteredPrevious =
        item.previousReading && item.previousReading.trim().length > 0
          ? Number(item.previousReading)
          : null;
      const currentReading = Number(item.currentReading);
      const ratePerUnit = Number(item.ratePerUnit);

      if (
        enteredPrevious !== null &&
        Math.abs(enteredPrevious - expectedPrevious) > 0.001
      ) {
        return {
          errors: [
            `Previous reading for ${meter.meterCode} must be ${expectedPrevious.toFixed(2)} on ${toDateInputValue(readingDate)}.`,
          ],
        };
      }

      if (currentReading < expectedPrevious) {
        return {
          errors: [
            `Current reading for ${meter.meterCode} cannot be lower than ${expectedPrevious.toFixed(2)}.`,
          ],
        };
      }

      if (
        nextEntry &&
        currentReading > Number(nextEntry.currentReading.toString())
      ) {
        return {
          errors: [
            `Current reading for ${meter.meterCode} cannot exceed later recorded value ${Number(nextEntry.currentReading.toString()).toFixed(2)}.`,
          ],
        };
      }

      let runningPreviousValue = currentReading;

      for (const laterEntry of timeline.filter(
        (entry) => entry.readingDate.getTime() > readingDate.getTime()
      )) {
        const nextCurrentValue = Number(laterEntry.currentReading.toString());

        if (nextCurrentValue < runningPreviousValue) {
          return {
            errors: [
              `Historical insertion for ${meter.meterCode} would break later reading chronology.`,
            ],
          };
        }

        if (laterEntry.invoiceItem) {
          return {
            errors: [
              `Historical insertion for ${meter.meterCode} would change a later billed reading. Use a manual utility charge instead.`,
            ],
          };
        }

        const laterRatePerUnit = Number(laterEntry.ratePerUnit.toString());
        const consumption = nextCurrentValue - runningPreviousValue;
        subsequentUpdates.set(laterEntry.id, {
          previousReading: runningPreviousValue,
          consumption,
          totalAmount: consumption * laterRatePerUnit,
        });

        runningPreviousValue = nextCurrentValue;
      }

      const consumption = currentReading - expectedPrevious;
      const totalAmount = consumption * ratePerUnit;

      normalizedRows.push({
        meterId,
        meterCode: meter.meterCode,
        utilityType: meter.utilityType,
        tenantId: params.contractTenantId,
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
        currentReading: {
          toString() {
            return currentReading.toString();
          },
        },
        ratePerUnit: {
          toString() {
            return ratePerUnit.toString();
          },
        },
        invoiceItem: null,
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

function revalidateBillingViews(invoiceId: string) {
  [
    "/dashboard",
    "/billing",
    `/billing/${invoiceId}`,
    `/billing/${invoiceId}/edit`,
    "/billing/backlog",
    "/tenants",
    "/utilities/readings",
  ].forEach((path) => revalidatePath(path));
}

export async function updateBacklogInvoiceAction(
  _previousState: BacklogInvoiceEditFormState,
  formData: FormData
): Promise<BacklogInvoiceEditFormState> {
  const user = await requireRole("ADMIN");

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  const issueDateRaw = String(formData.get("issueDate") ?? "").trim();
  const dueDateRaw = String(formData.get("dueDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const parsedItems = parseEditableItems(formData.get("editableItems"));

  if (!invoiceId) {
    return {
      message: "Backlog invoice is missing.",
      errors: {
        invoiceId: ["Backlog invoice is required."],
      },
    };
  }

  if (parsedItems.error) {
    return {
      message: parsedItems.error,
      errors: {
        editableItems: [parsedItems.error],
      },
    };
  }

  if (!issueDateRaw || Number.isNaN(new Date(issueDateRaw).getTime())) {
    return {
      message: "Issue date is invalid.",
      errors: {
        issueDate: ["Enter a valid issue date."],
      },
    };
  }

  if (!dueDateRaw || Number.isNaN(new Date(dueDateRaw).getTime())) {
    return {
      message: "Due date is invalid.",
      errors: {
        dueDate: ["Enter a valid due date."],
      },
    };
  }

  const normalizedItems: ParsedEditableItem[] = parsedItems.items.map((item) => ({
    id:
      item && typeof item === "object" && "id" in item ? String(item.id).trim() : "",
    itemType:
      item && typeof item === "object" && "itemType" in item
        ? String(item.itemType).trim()
        : "",
    description:
      item && typeof item === "object" && "description" in item
        ? String(item.description).trim()
        : "",
    amount:
      item && typeof item === "object" && "amount" in item
        ? String(item.amount).trim()
        : "",
    mode:
      item && typeof item === "object" && "mode" in item && item.mode === "meter"
        ? "meter"
        : "manual",
    isNew:
      item && typeof item === "object" && "isNew" in item ? Boolean(item.isNew) : false,
    meterId:
      item && typeof item === "object" && "meterId" in item
        ? String(item.meterId ?? "").trim() || undefined
        : undefined,
    meterReadingId:
      item && typeof item === "object" && "meterReadingId" in item
        ? String(item.meterReadingId ?? "").trim() || undefined
        : undefined,
    readingDate:
      item && typeof item === "object" && "readingDate" in item
        ? String(item.readingDate ?? "").trim() || undefined
        : undefined,
    previousReading:
      item && typeof item === "object" && "previousReading" in item
        ? String(item.previousReading ?? "").trim() || undefined
        : undefined,
    currentReading:
      item && typeof item === "object" && "currentReading" in item
        ? String(item.currentReading ?? "").trim() || undefined
        : undefined,
    ratePerUnit:
      item && typeof item === "object" && "ratePerUnit" in item
        ? String(item.ratePerUnit ?? "").trim() || undefined
        : undefined,
  }));
  const submittedItems = normalizedItems.filter(
    (item) => !isAutoManagedBacklogLine(item.itemType, item.description)
  );

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      origin: true,
      tenantId: true,
      billingPeriodStart: true,
      billingPeriodEnd: true,
      contract: {
        select: {
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
            },
          },
        },
      },
      items: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          itemType: true,
          meterReadingId: true,
          cosaAllocationId: true,
          contractRecurringChargeId: true,
          meterReading: {
            select: {
              id: true,
              meterId: true,
              meter: {
                select: {
                  meterCode: true,
                  utilityType: true,
                },
              },
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!invoice || invoice.origin !== "BACKLOG") {
    return {
      message: "Only backlog invoices can be edited here.",
    };
  }

  if (invoice.payments.length > 0) {
    return {
      message:
        "Backlog invoices with payments are locked. Remove payments first before editing.",
    };
  }

  const issueDate = endOfDay(new Date(issueDateRaw));
  const dueDate = endOfDay(new Date(dueDateRaw));

  if (dueDate < startOfDay(issueDate)) {
    return {
      message: "Due date cannot be earlier than issue date.",
      errors: {
        dueDate: ["Due date must be on or after issue date."],
      },
    };
  }

  const editableItemsById = new Map(
    invoice.items
      .filter((item) => !item.cosaAllocationId && !item.contractRecurringChargeId)
      .map((item) => [item.id, item])
  );
  const newMeterItems = submittedItems.filter((item) => item.isNew);

  for (const item of submittedItems) {
    if (item.isNew) {
      if (item.mode !== "meter") {
        return {
          message: "Only utility reading rows can be added here.",
          errors: {
            editableItems: ["Only utility reading rows can be added here."],
          },
        };
      }

      if (!item.meterId) {
        return {
          message: "Backlog utility reading meter is invalid.",
          errors: {
            editableItems: ["Every new utility reading needs a meter."],
          },
        };
      }

      if (!item.readingDate || Number.isNaN(new Date(item.readingDate).getTime())) {
        return {
          message: "Backlog reading date is invalid.",
          errors: {
            editableItems: ["Every backlog reading line needs a valid reading date."],
          },
        };
      }

      if (
        item.previousReading &&
        item.previousReading.length > 0 &&
        Number.isNaN(Number(item.previousReading))
      ) {
        return {
          message: "Backlog previous reading is invalid.",
          errors: {
            editableItems: ["Previous reading must be a valid number when entered."],
          },
        };
      }

      if (!item.currentReading || Number.isNaN(Number(item.currentReading))) {
        return {
          message: "Backlog current reading is invalid.",
          errors: {
            editableItems: ["Every backlog reading line needs a valid current reading."],
          },
        };
      }

      if (!item.ratePerUnit || Number.isNaN(Number(item.ratePerUnit))) {
        return {
          message: "Backlog rate per unit is invalid.",
          errors: {
            editableItems: ["Every backlog reading line needs a valid rate per unit."],
          },
        };
      }

      continue;
    }

    const invoiceItem = editableItemsById.get(item.id);

    if (!item.id || !invoiceItem) {
      return {
        message: "One or more backlog invoice lines are invalid.",
      };
    }

    if (item.mode === "manual") {
      if (!item.description) {
        return {
          message: "Editable invoice items need descriptions.",
          errors: {
            editableItems: ["Every editable line needs a description."],
          },
        };
      }

      if (item.amount === "" || Number.isNaN(Number(item.amount))) {
        return {
          message: "Editable invoice item amount is invalid.",
          errors: {
            editableItems: ["Every editable line needs a valid amount."],
          },
        };
      }

      continue;
    }

    if (!invoiceItem.meterReading || invoiceItem.meterReadingId !== item.meterReadingId) {
      return {
        message: "One or more backlog utility reading lines are invalid.",
      };
    }

    if (!item.readingDate || Number.isNaN(new Date(item.readingDate).getTime())) {
      return {
        message: "Backlog reading date is invalid.",
        errors: {
          editableItems: ["Every backlog reading line needs a valid reading date."],
        },
      };
    }

    if (!item.currentReading || Number.isNaN(Number(item.currentReading))) {
      return {
        message: "Backlog current reading is invalid.",
        errors: {
          editableItems: ["Every backlog reading line needs a valid current reading."],
        },
      };
    }

    if (!item.ratePerUnit || Number.isNaN(Number(item.ratePerUnit))) {
      return {
        message: "Backlog rate per unit is invalid.",
        errors: {
          editableItems: ["Every backlog reading line needs a valid rate per unit."],
        },
      };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const item of submittedItems) {
        if (item.isNew) {
          continue;
        }

        const invoiceItem = editableItemsById.get(item.id);

        if (!invoiceItem) {
          throw new BacklogEditValidationError(
            "One or more backlog invoice lines are invalid."
          );
        }

        if (item.mode === "manual") {
          const amount = Number(item.amount);

          await tx.invoiceItem.update({
            where: { id: item.id },
            data: {
              description: item.description,
              amount: toMoney(amount),
              unitPrice: toMoney(amount),
              quantity: toMoney(1),
            },
          });
          continue;
        }

        const meterReadingId = invoiceItem.meterReadingId;

        if (!meterReadingId || !invoiceItem.meterReading) {
          throw new BacklogEditValidationError(
            "One or more backlog utility reading lines are invalid."
          );
        }

        const readingDate = new Date(String(item.readingDate));
        const currentReading = Number(item.currentReading);
        const ratePerUnit = Number(item.ratePerUnit);

        const siblingReadings = await tx.meterReading.findMany({
          where: {
            meterId: invoiceItem.meterReading.meterId,
            id: {
              not: meterReadingId,
            },
          },
          orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            readingDate: true,
            currentReading: true,
            ratePerUnit: true,
            invoiceItem: {
              select: {
                id: true,
              },
            },
          },
        });

        const conflictingReading = siblingReadings.find(
          (reading) => reading.readingDate.getTime() === readingDate.getTime()
        );

        if (conflictingReading) {
          throw new BacklogEditValidationError(
            "Reading date must stay unique per meter.",
            {
              editableItems: [
                `Another reading already exists on ${invoiceItem.meterReading.meter.meterCode} for ${toDateInputValue(readingDate)}.`,
              ],
            }
          );
        }

        const laterBilledReading = siblingReadings.find(
          (reading) =>
            reading.readingDate.getTime() > readingDate.getTime() &&
            Boolean(reading.invoiceItem)
        );

        if (laterBilledReading) {
          throw new BacklogEditValidationError(
            "This backlog reading cannot be edited because a later billed reading depends on it.",
            {
              editableItems: [
                `Later billed readings already depend on ${invoiceItem.meterReading.meter.meterCode}. Use a manual utility charge instead.`,
              ],
            }
          );
        }

        const previousReading = findPreviousReading(siblingReadings, readingDate);
        const nextReading = findNextReading(siblingReadings, readingDate);
        const previousReadingValue = previousReading
          ? Number(previousReading.currentReading.toString())
          : 0;

        if (currentReading < previousReadingValue) {
          throw new BacklogEditValidationError(
            "Current reading cannot be lower than the previous reading.",
            {
              editableItems: [
                `Current reading for ${invoiceItem.meterReading.meter.meterCode} must be at least ${previousReadingValue.toFixed(2)}.`,
              ],
            }
          );
        }

        if (
          nextReading &&
          currentReading > Number(nextReading.currentReading.toString())
        ) {
          throw new BacklogEditValidationError(
            "Current reading cannot exceed the next recorded reading on the same meter.",
            {
              editableItems: [
                `Current reading for ${invoiceItem.meterReading.meter.meterCode} cannot exceed ${Number(nextReading.currentReading.toString()).toFixed(2)}.`,
              ],
            }
          );
        }

        const currentConsumption = currentReading - previousReadingValue;
        const currentTotalAmount = currentConsumption * ratePerUnit;
        const subsequentReadings = siblingReadings.filter(
          (reading) => reading.readingDate.getTime() > readingDate.getTime()
        );

        let runningPreviousValue = currentReading;

        for (const reading of subsequentReadings) {
          const nextCurrentValue = Number(reading.currentReading.toString());

          if (nextCurrentValue < runningPreviousValue) {
            throw new BacklogEditValidationError(
              "This edit would make a later reading invalid.",
              {
                editableItems: [
                  `Editing ${invoiceItem.meterReading.meter.meterCode} would break later reading chronology.`,
                ],
              }
            );
          }

          if (reading.invoiceItem) {
            throw new BacklogEditValidationError(
              "This edit would change a later billed reading.",
              {
                editableItems: [
                  `Editing ${invoiceItem.meterReading.meter.meterCode} would change a later billed reading. Use a manual utility charge instead.`,
                ],
              }
            );
          }

          const nextConsumption = nextCurrentValue - runningPreviousValue;
          const nextRatePerUnit = Number(reading.ratePerUnit.toString());

          await tx.meterReading.update({
            where: { id: reading.id },
            data: {
              previousReading: toMoney(runningPreviousValue),
              consumption: toMoney(nextConsumption),
              totalAmount: toMoney(nextConsumption * nextRatePerUnit),
            },
          });

          runningPreviousValue = nextCurrentValue;
        }

        await tx.meterReading.update({
          where: { id: meterReadingId },
          data: {
            readingDate,
            previousReading: toMoney(previousReadingValue),
            currentReading: toMoney(currentReading),
            consumption: toMoney(currentConsumption),
            ratePerUnit: toMoney(ratePerUnit),
            totalAmount: toMoney(currentTotalAmount),
          },
        });

        await tx.invoiceItem.update({
          where: { id: item.id },
          data: {
            description: buildMeterReadingDescription({
              utilityType: invoiceItem.meterReading.meter.utilityType,
              meterCode: invoiceItem.meterReading.meter.meterCode,
              readingDate,
            }),
            quantity: toMoney(currentConsumption),
            unitPrice: toMoney(ratePerUnit),
            amount: toMoney(currentTotalAmount),
          },
        });
      }

      if (newMeterItems.length > 0) {
        const allowedMeters = await tx.utilityMeter.findMany({
          where: {
            propertyId: invoice.contract.property.id,
            tenantId: invoice.tenantId,
            isShared: false,
          },
          orderBy: [{ utilityType: "asc" }, { meterCode: "asc" }],
          select: {
            id: true,
            tenantId: true,
            propertyId: true,
            isShared: true,
            meterCode: true,
            utilityType: true,
          },
        });

        const existingReadings = await tx.meterReading.findMany({
          where: {
            meterId: {
              in: allowedMeters.map((meter) => meter.id),
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
        });

        const readingValidation = validateNewMeterItems({
          items: newMeterItems,
          cycleStart: startOfDay(invoice.billingPeriodStart),
          cycleEnd: endOfDay(invoice.billingPeriodEnd),
          contractTenantId: invoice.tenantId,
          allowedMeters,
          existingReadings,
        });

        if (readingValidation.errors) {
          throw new BacklogEditValidationError(
            "New backlog utility readings are invalid.",
            {
              editableItems: readingValidation.errors,
            }
          );
        }

        const createdReadings: Array<PendingCreatedReading & { id: string }> = [];

        for (const row of readingValidation.normalizedRows) {
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
              recordedById: user.id,
            },
          });

          createdReadings.push({
            ...row,
            id: reading.id,
          });
        }

        for (const [readingId, update] of readingValidation.subsequentUpdates.entries()) {
          await tx.meterReading.update({
            where: { id: readingId },
            data: {
              previousReading: toMoney(update.previousReading),
              consumption: toMoney(update.consumption),
              totalAmount: toMoney(update.totalAmount),
            },
          });
        }

        for (const reading of createdReadings) {
          await tx.invoiceItem.create({
            data: {
              invoiceId,
              itemType: "UTILITY_READING",
              description: buildMeterReadingDescription({
                utilityType: reading.utilityType,
                meterCode: reading.meterCode,
                readingDate: reading.readingDate,
              }),
              quantity: toMoney(reading.consumption),
              unitPrice: toMoney(reading.ratePerUnit),
              amount: toMoney(reading.totalAmount),
              meterReadingId: reading.id,
            },
          });
        }
      }

      const existingItemsBeforeAutoSync = await tx.invoiceItem.findMany({
        where: {
          invoiceId,
        },
        select: {
          id: true,
          itemType: true,
          description: true,
          amount: true,
        },
      });
      const autoManagedItemIds = existingItemsBeforeAutoSync
        .filter((item) => isAutoManagedBacklogLine(item.itemType, item.description))
        .map((item) => item.id);

      if (autoManagedItemIds.length > 0) {
        await tx.invoiceItem.deleteMany({
          where: {
            id: {
              in: autoManagedItemIds,
            },
          },
        });
      }

      const baseItems = await tx.invoiceItem.findMany({
        where: {
          invoiceId,
        },
        select: {
          itemType: true,
          amount: true,
        },
      });
      const rentAmount = baseItems
        .filter((item) => item.itemType === "RENT")
        .reduce((sum, item) => sum + Number(item.amount.toString()), 0);
      const cycleStart = startOfDay(invoice.billingPeriodStart);
      const cycleLabel = formatBillingCycleLabel({
        start: cycleStart,
        end: endOfDay(invoice.billingPeriodEnd),
      });
      const autoFreeRentConcessionAmount = getAutoFreeRentConcessionAmount({
        contract: invoice.contract,
        cycleStart,
        rentAmount,
      });
      const autoAdvanceRentEffects = getAutoAdvanceRentEffects({
        contract: invoice.contract,
        cycleStart,
        rentAmount,
      });

      if (autoFreeRentConcessionAmount > 0) {
        await tx.invoiceItem.create({
          data: {
            invoiceId,
            itemType: "ADJUSTMENT",
            description: `Free rent concession · ${cycleLabel}`,
            quantity: toMoney(1),
            unitPrice: toMoney(-autoFreeRentConcessionAmount),
            amount: toMoney(-autoFreeRentConcessionAmount),
          },
        });
      }

      if (autoAdvanceRentEffects.creditAmount > 0) {
        await tx.invoiceItem.create({
          data: {
            invoiceId,
            itemType: "ADJUSTMENT",
            description: `Advance rent applied · ${cycleLabel}`,
            quantity: toMoney(1),
            unitPrice: toMoney(-autoAdvanceRentEffects.creditAmount),
            amount: toMoney(-autoAdvanceRentEffects.creditAmount),
          },
        });
      }

      const refreshedItems = await tx.invoiceItem.findMany({
        where: {
          invoiceId,
        },
        select: {
          itemType: true,
          amount: true,
        },
      });

      const subtotal = refreshedItems
        .filter((item) => item.itemType === "RENT")
        .reduce((sum, item) => sum + Number(item.amount.toString()), 0);
      const additionalCharges = refreshedItems
        .filter((item) => item.itemType !== "RENT")
        .reduce((sum, item) => sum + Number(item.amount.toString()), 0);
      const totalAmount = subtotal + additionalCharges;

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          issueDate,
          dueDate,
          notes: syncAutoManagedNotes(notes, {
            freeRentConcessionAmount: autoFreeRentConcessionAmount,
            advanceRentChargeAmount: autoAdvanceRentEffects.chargeAmount,
            advanceRentCreditAmount: autoAdvanceRentEffects.creditAmount,
          }),
          subtotal: toMoney(subtotal),
          additionalCharges: toMoney(additionalCharges),
          totalAmount: toMoney(totalAmount),
          balanceDue: toMoney(Math.max(0, totalAmount)),
          status: getInvoiceStatusFromBalance(Math.max(0, totalAmount), false),
        },
      });
    });
  } catch (error) {
    if (error instanceof BacklogEditValidationError) {
      return {
        message: error.message,
        errors: error.errors,
      };
    }

    return {
      message: "Backlog invoice could not be updated. Try again.",
    };
  }

  revalidateBillingViews(invoiceId);
  redirect(
    withToast(`/billing/${invoiceId}`, {
      intent: "success",
      title: "Backlog invoice updated",
      description: "Saved invoice changes and recalculated automatic lines.",
    })
  );
}
