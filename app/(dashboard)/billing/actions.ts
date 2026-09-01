"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { requireCapability } from "@/lib/auth/user";
import {
  getInvoiceTemplateLogoFileError,
  removeInvoiceTemplateLogoFile,
  storeInvoiceTemplateLogoFile,
} from "@/lib/properties/logo-storage";
import { prisma } from "@/lib/prisma";
import {
  buildCarryForwardAssignments,
  buildInvoiceGenerationLineId,
  buildPersistedCarryForwardKey,
  buildSyntheticCarryForwardKey,
  calculateInvoiceGenerationLineOutcome,
  parseCarryForwardKey,
  type InvoiceGenerationBillableLineType,
  type InvoiceGenerationCarryForwardSource,
  type InvoiceGenerationLineAdjustment,
  type InvoiceGenerationLinePreview,
  type InvoiceGenerationSelectedCycle,
} from "@/lib/billing/invoice-generation-adjustments";
import {
  filterCyclesWithoutInvoicedMonths,
  cycleOverlapsRange,
  findCosaTargetBillingCycle,
  findNextCompletedBillingCycles,
  formatBillingCycleLabel,
  getBillingCycleAtIndex,
  getBillingCycleKey,
  getInvoiceGenerationSelectionKey,
  getBillingMonthKey,
  getUtilityBillingWindowForCycle,
  isReadingInUtilityBillingWindow,
} from "@/lib/billing/cycles";
import { calculateAdjustedMonthlyRent } from "@/lib/billing/rent-adjustments";
import {
  calculateInvoiceAdjustmentAmount,
  WHOLE_INVOICE_TARGET,
  type InvoiceAdjustmentInput,
} from "@/lib/billing/invoice-adjustments";
import { getHistoricalBacklogCutoffDate } from "@/lib/billing/backlog";
import { generateInvoiceAccessCode } from "@/lib/billing/public-access";
import { calculateCosaAllocations } from "@/lib/billing/cosa";
import { buildInvoiceNumber } from "@/lib/billing/invoice-number";
import { UTILITY_TYPE_LABELS } from "@/lib/form-options";
import {
  buildAdvanceApplicationCycleIndexes,
  deriveWholeMonths,
} from "@/lib/contracts/advance-rent";
import { getDescendantPropertyIds } from "@/lib/property-tree";
import { withToast } from "@/lib/toast";
import { invoiceBrandingTemplateSchema } from "@/lib/validations/invoice-branding-template";
import { cosaSchema } from "@/lib/validations/cosa";
import { cosaTemplateSchema } from "@/lib/validations/cosa-template";
import { invoiceGenerationSchema } from "@/lib/validations/invoice-generation";
import {
  bulkPaymentRecordingSchema,
  paymentRecordingSchema,
} from "@/lib/validations/payment-recording";
import { recurringChargeSchema } from "@/lib/validations/recurring-charge";
import {
  dateInputToAppEndOfDay,
  formatDate,
  toDateInputValue,
} from "@/lib/format";

export type InvoiceGenerationFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type RecurringChargeFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type CosaFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type CosaTemplateFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type InvoiceBrandingTemplateFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type RecordPaymentFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type BulkRecordPaymentFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

const READING_SELECTION_SEPARATOR = "::";

type ParsedPaymentPayload = ReturnType<typeof getPaymentPayload>;
type ParsedBulkPaymentPayload = ReturnType<typeof getBulkPaymentPayload>;
type ParsedCosaPayload = ReturnType<typeof getCosaPayload>;
type ParsedCosaTemplatePayload = ReturnType<typeof getCosaTemplatePayload>;
type ParsedInvoiceGenerationPayload = ReturnType<typeof getInvoiceGenerationPayload>;

function getInvoiceGenerationPayload(formData: FormData) {
  const lineAdjustmentsResult = parseJsonArray(
    formData.get("lineAdjustments"),
    "Invoice line adjustment data is invalid."
  );
  const carryForwardSelectionsResult = parseJsonArray(
    formData.get("carryForwardSelections"),
    "Deferred balance selection data is invalid."
  );
  const invoiceAdjustmentsResult = parseJsonArray(
    formData.get("invoiceAdjustments"),
    "Invoice addition and deduction data is invalid."
  );

  return {
    tenantId: String(formData.get("tenantId") ?? ""),
    cycleSelections: formData
      .getAll("cycleSelections")
      .map((value) => String(value))
      .filter(Boolean),
    readingSelections: formData
      .getAll("readingSelections")
      .map((value) => String(value))
      .filter(Boolean),
    issueDate: String(formData.get("issueDate") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    lineAdjustments: lineAdjustmentsResult.items,
    lineAdjustmentsParseError: lineAdjustmentsResult.error,
    invoiceAdjustments: invoiceAdjustmentsResult.items,
    invoiceAdjustmentsParseError: invoiceAdjustmentsResult.error,
    carryForwardSelections: carryForwardSelectionsResult.items,
    carryForwardSelectionsParseError: carryForwardSelectionsResult.error,
  };
}

function buildReadingSelectionKey(cycleSelectionKey: string, readingId: string) {
  return `${cycleSelectionKey}${READING_SELECTION_SEPARATOR}${readingId}`;
}

function parseReadingSelectionKey(value: string) {
  const separatorIndex = value.lastIndexOf(READING_SELECTION_SEPARATOR);

  if (
    separatorIndex <= 0 ||
    separatorIndex >= value.length - READING_SELECTION_SEPARATOR.length
  ) {
    return null;
  }

  return {
    cycleSelectionKey: value.slice(0, separatorIndex),
    readingId: value.slice(separatorIndex + READING_SELECTION_SEPARATOR.length),
  };
}

function getRecurringChargePayload(formData: FormData) {
  return {
    contractId: String(formData.get("contractId") ?? ""),
    chargeType: String(formData.get("chargeType") ?? ""),
    label: String(formData.get("label") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    descriptionDateDisplayOverride: String(
      formData.get("descriptionDateDisplayOverride") ?? ""
    ),
    effectiveStartDate: String(formData.get("effectiveStartDate") ?? ""),
    effectiveEndDate: String(formData.get("effectiveEndDate") ?? ""),
    isActive: formData.get("isActive") === "on",
  };
}

function getCosaPayload(formData: FormData) {
  const allocationsResult = parseAllocations(
    formData.get("allocations"),
    "COSA allocation data is invalid."
  );

  return {
    propertyId: String(formData.get("propertyId") ?? ""),
    meterId: String(formData.get("meterId") ?? ""),
    meterReadingId: String(formData.get("meterReadingId") ?? ""),
    description: String(formData.get("description") ?? ""),
    totalAmount: String(formData.get("totalAmount") ?? ""),
    calculationMode: String(formData.get("calculationMode") ?? "MANUAL_TOTAL"),
    quantity: String(formData.get("quantity") ?? ""),
    unitRate: String(formData.get("unitRate") ?? ""),
    billingDate: String(formData.get("billingDate") ?? ""),
    allocationType: String(formData.get("allocationType") ?? ""),
    allocations: allocationsResult.allocations,
    allocationsParseError: allocationsResult.error,
    successRedirectTo: String(formData.get("successRedirectTo") ?? ""),
  };
}

function getCosaTemplatePayload(formData: FormData) {
  const allocationsResult = parseAllocations(
    formData.get("allocations"),
    "COSA template allocation data is invalid."
  );

  return {
    propertyId: String(formData.get("propertyId") ?? ""),
    meterId: String(formData.get("meterId") ?? ""),
    name: String(formData.get("name") ?? ""),
    allocationType: String(formData.get("allocationType") ?? ""),
    defaultAmount: String(formData.get("defaultAmount") ?? ""),
    calculationMode: String(formData.get("calculationMode") ?? "MANUAL_TOTAL"),
    dailyRate: String(formData.get("dailyRate") ?? ""),
    isActive: formData.get("isActive") === "on",
    allocations: allocationsResult.allocations,
    allocationsParseError: allocationsResult.error,
  };
}

function getInvoiceBrandingTemplatePayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    brandName: String(formData.get("brandName") ?? ""),
    brandSubtitle: String(formData.get("brandSubtitle") ?? ""),
    fontFamily: String(formData.get("fontFamily") ?? ""),
    showBrandName: formData.get("showBrandName") === "on",
    showBrandSubtitle: formData.get("showBrandSubtitle") === "on",
    invoiceTitlePrefix: String(formData.get("invoiceTitlePrefix") ?? ""),
    usePropertyLogo: formData.get("usePropertyLogo") === "on",
    titleScale: String(formData.get("titleScale") ?? ""),
    logoScalePercent: String(formData.get("logoScalePercent") ?? ""),
    brandNameSizePercent: String(formData.get("brandNameSizePercent") ?? ""),
    brandSubtitleSizePercent: String(formData.get("brandSubtitleSizePercent") ?? ""),
    tenantNameSizePercent: String(formData.get("tenantNameSizePercent") ?? ""),
    titleSizePercent: String(formData.get("titleSizePercent") ?? ""),
    brandNameWeight: String(formData.get("brandNameWeight") ?? ""),
    tenantNameWeight: String(formData.get("tenantNameWeight") ?? ""),
    titleWeight: String(formData.get("titleWeight") ?? ""),
    accentColor: String(formData.get("accentColor") ?? ""),
    labelColor: String(formData.get("labelColor") ?? ""),
    valueColor: String(formData.get("valueColor") ?? ""),
    mutedColor: String(formData.get("mutedColor") ?? ""),
    panelBackground: String(formData.get("panelBackground") ?? ""),
    isDefault: formData.get("isDefault") === "on",
    removeLogo: formData.get("removeLogo") === "true",
    propertyIds: formData
      .getAll("propertyIds")
      .map((value) => String(value))
      .filter(Boolean),
  };
}

function parseAllocations(
  value: FormDataEntryValue | null,
  errorMessage = "Allocation data is invalid."
) {
  const parsed = parseJsonArray(value, errorMessage);

  return {
    allocations: parsed.items,
    error: parsed.error,
  };
}

function parseJsonArray(
  value: FormDataEntryValue | null,
  errorMessage = "Data is invalid."
) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return {
      items: [],
      error: null,
    };
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return {
        items: [],
        error: errorMessage,
      };
    }

    return {
      items: parsed,
      error: null,
    };
  } catch {
    return {
      items: [],
      error: errorMessage,
    };
  }
}

function getPaymentPayload(formData: FormData) {
  const allocationsResult = parseAllocations(
    formData.get("allocations"),
    "Payment allocation data is invalid."
  );

  return {
    paymentDate: String(formData.get("paymentDate") ?? ""),
    referenceNumber: String(formData.get("referenceNumber") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    allocations: allocationsResult.allocations,
    allocationsParseError: allocationsResult.error,
  };
}

function getBulkPaymentPayload(formData: FormData) {
  const rawInvoiceIds = String(formData.get("invoiceIds") ?? "").trim();

  if (!rawInvoiceIds) {
    return {
      paymentDate: String(formData.get("paymentDate") ?? ""),
      referenceNumber: String(formData.get("referenceNumber") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      invoiceIds: [],
      invoiceIdsParseError: null,
    };
  }

  try {
    const parsed = JSON.parse(rawInvoiceIds);

    if (!Array.isArray(parsed)) {
      return {
        paymentDate: String(formData.get("paymentDate") ?? ""),
        referenceNumber: String(formData.get("referenceNumber") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        invoiceIds: [],
        invoiceIdsParseError: "Selected invoice data is invalid.",
      };
    }

    return {
      paymentDate: String(formData.get("paymentDate") ?? ""),
      referenceNumber: String(formData.get("referenceNumber") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      invoiceIds: parsed
        .map((value) => String(value).trim())
        .filter(Boolean),
      invoiceIdsParseError: null,
    };
  } catch {
    return {
      paymentDate: String(formData.get("paymentDate") ?? ""),
      referenceNumber: String(formData.get("referenceNumber") ?? ""),
      notes: String(formData.get("notes") ?? ""),
      invoiceIds: [],
      invoiceIdsParseError: "Selected invoice data is invalid.",
    };
  }
}

function getPaymentParseError(
  payload: ParsedPaymentPayload
): RecordPaymentFormState | null {
  if (!payload.allocationsParseError) {
    return null;
  }

  return {
    errors: {
      allocations: [payload.allocationsParseError],
    },
    message: "Payment allocations could not be read. Try again.",
  };
}

function getBulkPaymentParseError(
  payload: ParsedBulkPaymentPayload
): BulkRecordPaymentFormState | null {
  if (!payload.invoiceIdsParseError) {
    return null;
  }

  return {
    errors: {
      invoiceIds: [payload.invoiceIdsParseError],
    },
    message: "Selected invoices could not be read. Refresh and try again.",
  };
}

function getCosaParseError(payload: ParsedCosaPayload): CosaFormState | null {
  if (!payload.allocationsParseError) {
    return null;
  }

  return {
    errors: {
      allocations: [payload.allocationsParseError],
    },
    message: "COSA allocation data could not be read. Refresh and try again.",
  };
}

function getInvoiceGenerationParseError(
  payload: ParsedInvoiceGenerationPayload
): InvoiceGenerationFormState | null {
  if (
    !payload.lineAdjustmentsParseError &&
    !payload.invoiceAdjustmentsParseError &&
    !payload.carryForwardSelectionsParseError
  ) {
    return null;
  }

  return {
    errors: {
      lineAdjustments: payload.lineAdjustmentsParseError
        ? [payload.lineAdjustmentsParseError]
        : undefined,
      invoiceAdjustments: payload.invoiceAdjustmentsParseError
        ? [payload.invoiceAdjustmentsParseError]
        : undefined,
      carryForwardSelections: payload.carryForwardSelectionsParseError
        ? [payload.carryForwardSelectionsParseError]
        : undefined,
    },
    message: "Invoice generation options could not be read. Refresh and try again.",
  };
}

function getCosaTemplateParseError(
  payload: ParsedCosaTemplatePayload
): CosaTemplateFormState | null {
  if (!payload.allocationsParseError) {
    return null;
  }

  return {
    errors: {
      allocations: [payload.allocationsParseError],
    },
    message:
      "COSA template allocation data could not be read. Refresh and try again.",
  };
}

async function resolveInvoiceTemplateLogoInput(
  formData: FormData,
  currentLogo?: {
    logoUrl: string | null;
    logoStorageKey: string | null;
  }
) {
  const logoFile = formData.get("logoFile");
  const removeLogo = formData.get("removeLogo") === "true";
  const nextLogoFile =
    logoFile instanceof File && logoFile.size > 0 ? logoFile : null;

  if (nextLogoFile) {
    const logoFileError = getInvoiceTemplateLogoFileError(nextLogoFile);

    if (logoFileError) {
      return {
        error: logoFileError,
      };
    }

    const storedLogo = await storeInvoiceTemplateLogoFile(nextLogoFile);

    return {
      ...storedLogo,
      replacedStorageKey: currentLogo?.logoStorageKey ?? null,
    };
  }

  if (removeLogo) {
    return {
      logoUrl: null,
      logoStorageKey: null,
      replacedStorageKey: currentLogo?.logoStorageKey ?? null,
    };
  }

  return {
    logoUrl: currentLogo?.logoUrl ?? null,
    logoStorageKey: currentLogo?.logoStorageKey ?? null,
    replacedStorageKey: null,
  };
}

function revalidateBillingViews() {
  [
    "/dashboard",
    "/billing",
    "/billing/invoice-templates",
    "/billing/backlog",
    "/billing/cosa",
    "/billing/cosa/templates",
    "/billing/charges",
    "/contracts",
    "/tenants",
    "/utilities",
    "/properties",
  ].forEach((path) => revalidatePath(path));
}

async function validateInvoiceBrandingTemplateProperties(propertyIds: string[]) {
  if (propertyIds.length === 0) {
    return true;
  }

  const count = await prisma.property.count({
    where: {
      id: {
        in: propertyIds,
      },
    },
  });

  return count === propertyIds.length;
}

function toMoney(value: number) {
  return value.toFixed(2);
}

function buildUtilityReadingDescription(params: {
  utilityType: keyof typeof UTILITY_TYPE_LABELS;
  meterCode: string;
  serviceStart: Date;
  serviceEnd: Date;
}) {
  return `${UTILITY_TYPE_LABELS[params.utilityType]} reading · ${params.meterCode} · service ${formatDate(params.serviceStart)} to ${formatDate(params.serviceEnd)}`;
}

function endOfDay(value: Date) {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

function getBillingCycleIndex(anchorDate: Date, cycleStart: Date) {
  for (let cycleIndex = 0; cycleIndex < 240; cycleIndex += 1) {
    const cycle = getBillingCycleAtIndex(anchorDate, cycleIndex);

    if (cycle.start.getTime() === cycleStart.getTime()) {
      return cycleIndex;
    }

    if (cycle.start > cycleStart) {
      break;
    }
  }

  return -1;
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

type InvoiceGenerationBaseLine = InvoiceGenerationLinePreview & {
  quantity: number;
  unitPrice: number;
  description: string;
  contractRecurringChargeId?: string;
  meterReadingId?: string;
  cosaAllocationId?: string;
};

type InvoiceGenerationPersistedDeferredBalance = {
  id: string;
  contractId: string;
  tenantId: string;
  sourceDescription: string;
  deferredAmount: number;
  sourceItemType: InvoiceGenerationBillableLineType | "ADJUSTMENT" | "ARREARS";
  sourceInvoice: {
    id: string;
    invoiceNumber: string;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
  };
};

type GeneratedDeferredBalanceRecord = {
  id: string;
  contractId: string;
  tenantId: string;
  sourceDescription: string;
  deferredAmount: number;
  sourceInvoice: {
    id: string;
    invoiceNumber: string;
    billingPeriodStart: Date;
    billingPeriodEnd: Date;
  };
};

function formatMoneyForNote(value: number) {
  return `₱${new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function buildInvoiceAdjustmentDescription(params: {
  lineLabel: string;
  cycleLabel: string;
  action: "DISCOUNT" | "DEFER";
}) {
  return `${
    params.action === "DISCOUNT" ? "Discount applied" : "Deferred balance"
  } · ${params.lineLabel} · ${params.cycleLabel}`;
}

function buildDeferredBalanceNote(params: {
  lineLabel: string;
  cycleLabel: string;
  deferredAmount: number;
}) {
  return `Deferred ${formatMoneyForNote(params.deferredAmount)} from ${params.lineLabel} for ${params.cycleLabel} to future invoice.`;
}

function buildDiscountNote(params: {
  lineLabel: string;
  cycleLabel: string;
  discountAmount: number;
}) {
  return `Discounted ${formatMoneyForNote(params.discountAmount)} from ${params.lineLabel} for ${params.cycleLabel}.`;
}

function buildDeferredBalanceSourceDescription(params: {
  lineLabel: string;
  cycleLabel: string;
}) {
  return `${params.lineLabel} for ${params.cycleLabel}`;
}

function buildCarryForwardArrearsDescription(params: {
  invoiceNumber: string;
  sourceDescription: string;
}) {
  return `Arrears from ${params.invoiceNumber} ${params.sourceDescription.toLowerCase()}`;
}

function buildInvoiceGenerationBaseLines(params: {
  cycleSelectionKey: string;
  cycleLabel: string;
  contractId: string;
  propertyName: string;
  cycleStart: Date;
  cycleEnd: Date;
  rentAmount: number;
  utilityServiceCycle:
    | {
        start: Date;
        end: Date;
      }
    | null;
  cycleCharges: Array<{
    id: string;
    label: string;
    amount: { toString(): string };
  }>;
  selectedCycleReadings: Array<{
    id: string;
    readingDate: Date;
    consumption: { toString(): string };
    ratePerUnit: { toString(): string };
    totalAmount: { toString(): string };
    meter: {
      meterCode: string;
      utilityType: keyof typeof UTILITY_TYPE_LABELS;
    };
  }>;
  cycleCosaAllocations: Array<{
    id: string;
    computedAmount: { toString(): string };
    cosa: {
      description: string;
      calculationMode: "METER_READING" | "DAILY_RATE" | "MANUAL_TOTAL";
      quantity: { toString(): string } | null;
      unitRate: { toString(): string } | null;
    };
  }>;
}) {
  return [
    {
      lineId: buildInvoiceGenerationLineId({
        cycleSelectionKey: params.cycleSelectionKey,
        lineType: "rent",
      }),
      cycleSelectionKey: params.cycleSelectionKey,
      contractId: params.contractId,
      type: "RENT" as const,
      label: "Rent",
      description: `Rent for ${params.cycleLabel} · ${params.propertyName} · ${toDateInputValue(params.cycleStart)} to ${toDateInputValue(params.cycleEnd)}`,
      amount: params.rentAmount,
      quantity: 1,
      unitPrice: params.rentAmount,
    },
    ...params.cycleCharges.map((charge) => ({
      lineId: buildInvoiceGenerationLineId({
        cycleSelectionKey: params.cycleSelectionKey,
        lineType: "recurring",
        sourceId: charge.id,
      }),
      cycleSelectionKey: params.cycleSelectionKey,
      contractId: params.contractId,
      type: "RECURRING_CHARGE" as const,
      label: charge.label,
      description: `${charge.label} · ${toDateInputValue(params.cycleStart)} to ${toDateInputValue(params.cycleEnd)}`,
      amount: Number(charge.amount.toString()),
      quantity: 1,
      unitPrice: Number(charge.amount.toString()),
      contractRecurringChargeId: charge.id,
    })),
    ...params.selectedCycleReadings.map((reading) => ({
      lineId: buildInvoiceGenerationLineId({
        cycleSelectionKey: params.cycleSelectionKey,
        lineType: "reading",
        sourceId: reading.id,
      }),
      cycleSelectionKey: params.cycleSelectionKey,
      contractId: params.contractId,
      type: "UTILITY_READING" as const,
      label: `${UTILITY_TYPE_LABELS[reading.meter.utilityType]} · ${reading.meter.meterCode}`,
      description:
        params.utilityServiceCycle != null
          ? buildUtilityReadingDescription({
              utilityType: reading.meter.utilityType,
              meterCode: reading.meter.meterCode,
              serviceStart: params.utilityServiceCycle.start,
              serviceEnd: params.utilityServiceCycle.end,
            })
          : `${reading.meter.utilityType.replaceAll("_", " ")} reading · ${reading.meter.meterCode} · ${reading.readingDate.toISOString().slice(0, 10)}`,
      amount: Number(reading.totalAmount.toString()),
      quantity: Number(reading.consumption.toString()),
      unitPrice: Number(reading.ratePerUnit.toString()),
      meterReadingId: reading.id,
    })),
    ...params.cycleCosaAllocations.map((allocation) => ({
      lineId: buildInvoiceGenerationLineId({
        cycleSelectionKey: params.cycleSelectionKey,
        lineType: "cosa",
        sourceId: allocation.id,
      }),
      cycleSelectionKey: params.cycleSelectionKey,
      contractId: params.contractId,
      type: "COSA" as const,
      label: allocation.cosa.description,
      description:
        allocation.cosa.calculationMode === "DAILY_RATE" &&
        allocation.cosa.quantity &&
        allocation.cosa.unitRate
          ? `${allocation.cosa.description} · ${Number(allocation.cosa.quantity.toString())} days × ${formatMoneyForNote(Number(allocation.cosa.unitRate.toString()))}/day`
          : allocation.cosa.description,
      amount: Number(allocation.computedAmount.toString()),
      quantity: 1,
      unitPrice: Number(allocation.computedAmount.toString()),
      cosaAllocationId: allocation.id,
    })),
  ] satisfies InvoiceGenerationBaseLine[];
}

function groupLineAdjustmentsByCycle(
  lineAdjustments: InvoiceGenerationLineAdjustment[]
) {
  const grouped = new Map<string, Map<string, InvoiceGenerationLineAdjustment>>();

  for (const adjustment of lineAdjustments) {
    const cycleAdjustments =
      grouped.get(adjustment.cycleSelectionKey) ??
      new Map<string, InvoiceGenerationLineAdjustment>();

    cycleAdjustments.set(adjustment.lineId, adjustment);
    grouped.set(adjustment.cycleSelectionKey, cycleAdjustments);
  }

  return grouped;
}

function groupInvoiceAdjustmentsByCycle(
  adjustments: InvoiceAdjustmentInput[]
) {
  const grouped = new Map<string, InvoiceAdjustmentInput[]>();

  for (const adjustment of adjustments) {
    grouped.set(adjustment.cycleSelectionKey, [
      ...(grouped.get(adjustment.cycleSelectionKey) ?? []),
      adjustment,
    ]);
  }

  return grouped;
}

function groupCarryForwardSelectionsByCycle(
  selections: Array<{ cycleSelectionKey: string; carryForwardKey: string }>
) {
  const grouped = new Map<string, Set<string>>();

  for (const selection of selections) {
    const cycleSelections =
      grouped.get(selection.cycleSelectionKey) ?? new Set<string>();
    cycleSelections.add(selection.carryForwardKey);
    grouped.set(selection.cycleSelectionKey, cycleSelections);
  }

  return grouped;
}

async function validateRecurringChargeContract(
  contractId: string,
  currentContractId?: string
) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!contract) {
    return {
      contractId: ["Select a valid contract."],
    };
  }

  if (
    !["DRAFT", "ACTIVE"].includes(contract.status) &&
    contract.id !== currentContractId
  ) {
    return {
      contractId: ["Recurring charges can only be attached to draft or active contracts."],
    };
  }

  return null;
}

async function validateCosaSelections(params: {
  propertyId: string;
  meterId?: string;
  meterReadingId?: string;
  contractIds: string[];
  editableContractIds?: string[];
  editableCosaId?: string;
}) {
  const {
    propertyId,
    meterId,
    meterReadingId,
    contractIds,
    editableContractIds = [],
    editableCosaId,
  } = params;
  const [properties, meter, meterReading, contracts] = await Promise.all([
    prisma.property.findMany({
      select: {
        id: true,
        parentPropertyId: true,
        status: true,
      },
    }),
    meterId
      ? prisma.utilityMeter.findUnique({
          where: { id: meterId },
          select: {
            id: true,
            propertyId: true,
            isShared: true,
          },
        })
      : Promise.resolve(null),
    meterReadingId
      ? prisma.meterReading.findUnique({
          where: { id: meterReadingId },
          select: {
            id: true,
            meterId: true,
            totalAmount: true,
            readingDate: true,
            previousReading: true,
            currentReading: true,
            consumption: true,
            ratePerUnit: true,
            cosa: {
              select: {
                id: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    prisma.contract.findMany({
      where: {
        id: {
          in: contractIds,
        },
      },
      select: {
        id: true,
        status: true,
        propertyId: true,
        property: {
          select: {
            size: true,
          },
        },
      },
    }),
  ]);

  const property = properties.find((entry) => entry.id === propertyId);

  if (!property || property.status === "ARCHIVED") {
    return {
      errors: {
        propertyId: ["Select a valid active property."],
      },
      contracts: [],
      propertyScopeIds: new Set<string>(),
      meterReading: null,
    };
  }

  if (meterId) {
    if (!meter || !meter.isShared || meter.propertyId !== propertyId) {
      return {
        errors: {
          meterId: ["Select a shared meter linked to the chosen property."],
        },
        contracts: [],
        propertyScopeIds: new Set<string>(),
        meterReading: null,
      };
    }
  }

  if (meterReadingId) {
    if (!meterId || !meterReading || meterReading.meterId !== meterId) {
      return {
        errors: {
          meterReadingId: [
            "Select a valid recorded reading from the chosen shared meter.",
          ],
        },
        contracts: [],
        propertyScopeIds: new Set<string>(),
        meterReading: null,
      };
    }

    if (meterReading.cosa && meterReading.cosa.id !== editableCosaId) {
      return {
        errors: {
          meterReadingId: [
            "That shared-meter reading is already linked to another COSA record.",
          ],
        },
        contracts: [],
        propertyScopeIds: new Set<string>(),
        meterReading: null,
      };
    }
  }

  const propertyScopeIds = getDescendantPropertyIds(propertyId, properties);

  if (contracts.length !== contractIds.length) {
    return {
      errors: {
        allocations: ["One or more selected contracts are invalid."],
      },
      contracts: [],
      propertyScopeIds,
      meterReading,
    };
  }

  const invalidContracts = contracts.filter(
    (contract) =>
      !propertyScopeIds.has(contract.propertyId) ||
      (contract.status !== "ACTIVE" && !editableContractIds.includes(contract.id))
  );

  if (invalidContracts.length > 0) {
    return {
      errors: {
        allocations: [
          "Selected contracts must belong to the chosen property scope and remain active.",
        ],
      },
      contracts: [],
      propertyScopeIds,
      meterReading,
    };
  }

  return {
    errors: null,
    contracts,
    propertyScopeIds,
    meterReading,
  };
}

function getInvoiceStatusFromBalance(balance: number, hasPayments: boolean) {
  if (balance <= 0) {
    return "PAID" as const;
  }

  return hasPayments ? ("PARTIALLY_PAID" as const) : ("ISSUED" as const);
}

type PaymentEligibleInvoice = {
  id: string;
  invoiceNumber: string;
  contractId: string;
  dueDate: Date;
  status: string;
  items: {
    id: string;
    amount: { toString(): string };
    allocations: {
      amountAllocated: { toString(): string };
    }[];
  }[];
  payments: {
    id: string;
  }[];
};

type NormalizedPaymentAllocation = {
  invoiceItemId: string;
  amount: number;
};

function buildInvoiceItemMap(invoice: PaymentEligibleInvoice) {
  return new Map(
    invoice.items.map((item) => {
      const allocatedAmount = item.allocations.reduce(
        (sum, allocation) => sum + Number(allocation.amountAllocated.toString()),
        0
      );

      return [
        item.id,
        {
          amount: Number(item.amount.toString()),
          allocatedAmount,
          remainingAmount: Number(item.amount.toString()) - allocatedAmount,
        },
      ];
    })
  );
}

function validatePaymentAllocations(
  itemMap: ReturnType<typeof buildInvoiceItemMap>,
  allocations: NormalizedPaymentAllocation[]
) {
  const allocationErrors: string[] = [];

  for (const allocation of allocations) {
    const invoiceItem = itemMap.get(allocation.invoiceItemId);

    if (!invoiceItem) {
      allocationErrors.push("One or more allocations do not belong to this invoice.");
      continue;
    }

    if (allocation.amount > invoiceItem.remainingAmount + 0.001) {
      allocationErrors.push(
        "Allocation amounts cannot exceed the remaining balance of an item."
      );
    }
  }

  return allocationErrors;
}

function buildFullRemainingAllocations(invoice: PaymentEligibleInvoice) {
  return invoice.items
    .map((item) => {
      const allocatedAmount = item.allocations.reduce(
        (sum, allocation) => sum + Number(allocation.amountAllocated.toString()),
        0
      );
      const remainingAmount = Math.max(
        0,
        Number(item.amount.toString()) - allocatedAmount
      );

      return {
        invoiceItemId: item.id,
        amount: remainingAmount,
      };
    })
    .filter((allocation) => allocation.amount > 0);
}

async function persistInvoicePayment(params: {
  invoice: PaymentEligibleInvoice;
  allocations: NormalizedPaymentAllocation[];
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
}) {
  const { invoice, allocations, paymentDate, referenceNumber, notes } = params;
  const itemMap = buildInvoiceItemMap(invoice);
  const totalAllocated = allocations.reduce(
    (sum, allocation) => sum + allocation.amount,
    0
  );
  const totalRemaining = [...itemMap.values()].reduce(
    (sum, item) => sum + item.remainingAmount,
    0
  );
  const nextBalance = Math.max(0, totalRemaining - totalAllocated);

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        contractId: invoice.contractId,
        amountPaid: toMoney(totalAllocated),
        dueDate: invoice.dueDate,
        paymentDate: new Date(paymentDate),
        status: "SETTLED",
        referenceNumber: referenceNumber ?? null,
        notes: notes ?? null,
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
        status: getInvoiceStatusFromBalance(
          nextBalance,
          invoice.payments.length > 0 || allocations.length > 0
        ),
      },
    });
  });
}

export async function generateInvoicesAction(
  _previousState: InvoiceGenerationFormState,
  formData: FormData
): Promise<InvoiceGenerationFormState> {
  const user = await requireCapability("MANAGE_BILLING");

  const payload = getInvoiceGenerationPayload(formData);
  const parseError = getInvoiceGenerationParseError(payload);

  if (parseError) {
    return parseError;
  }

  const validatedFields = invoiceGenerationSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted billing fields and try again.",
    };
  }

  const issueDate = dateInputToAppEndOfDay(validatedFields.data.issueDate);
  const dueDate = dateInputToAppEndOfDay(validatedFields.data.dueDate);
  const cutoffDate = getHistoricalBacklogCutoffDate();

  const contracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      tenantId: validatedFields.data.tenantId,
    },
    select: {
      id: true,
      tenantId: true,
      monthlyRent: true,
      securityDepositMonths: true,
      advanceRentMonths: true,
      freeRentCycles: true,
      advanceRentApplication: true,
      advanceRentFirstMonths: true,
      advanceRentLastMonths: true,
      advanceRent: true,
      securityDeposit: true,
      paymentStartDate: true,
      endDate: true,
      rentAdjustments: {
        orderBy: [{ effectiveDate: "asc" }],
        select: {
          effectiveDate: true,
          increaseType: true,
          increaseValue: true,
          calculationType: true,
          basedOn: true,
        },
      },
      property: {
        select: {
          id: true,
          propertyCode: true,
          name: true,
        },
      },
    },
  });

  if (contracts.length === 0) {
    return {
      errors: {
        tenantId: ["Select a business with active billing-ready contracts."],
      },
      message: "Business selection is invalid for invoice generation.",
    };
  }

  const selectedCycleKeys = new Set(validatedFields.data.cycleSelections);
  const submittedReadingSelectionKeys = new Set(
    validatedFields.data.readingSelections
  );
  const selectedLineAdjustmentsByCycle = groupLineAdjustmentsByCycle(
    validatedFields.data.lineAdjustments as InvoiceGenerationLineAdjustment[]
  );
  const selectedInvoiceAdjustmentsByCycle = groupInvoiceAdjustmentsByCycle(
    validatedFields.data.invoiceAdjustments as InvoiceAdjustmentInput[]
  );
  const selectedCarryForwardKeysByCycle = groupCarryForwardSelectionsByCycle(
    validatedFields.data.carryForwardSelections
  );
  const selectedReadingIdsByCycle = new Map<string, Set<string>>();

  for (const readingSelection of submittedReadingSelectionKeys) {
    const parsedSelection = parseReadingSelectionKey(readingSelection);

    if (!parsedSelection) {
      return {
        errors: {
          readingSelections: [
            "One or more selected utility readings are invalid. Refresh and try again.",
          ],
        },
        message: "Utility reading selection is invalid.",
      };
    }

    const readingIds =
      selectedReadingIdsByCycle.get(parsedSelection.cycleSelectionKey) ??
      new Set<string>();
    readingIds.add(parsedSelection.readingId);
    selectedReadingIdsByCycle.set(parsedSelection.cycleSelectionKey, readingIds);
  }

  const [
    existingInvoices,
    recurringCharges,
    readings,
    cosaAllocations,
    deferredBalances,
  ] =
    await Promise.all([
    prisma.invoice.findMany({
      where: {
        contractId: {
          in: contracts.map((contract) => contract.id),
        },
      },
      select: {
        contractId: true,
        billingPeriodStart: true,
        billingPeriodEnd: true,
      },
    }),
    prisma.contractRecurringCharge.findMany({
      where: {
        contractId: {
          in: contracts.map((contract) => contract.id),
        },
        isActive: true,
      },
      select: {
        id: true,
        contractId: true,
        chargeType: true,
        label: true,
        amount: true,
        effectiveStartDate: true,
        effectiveEndDate: true,
      },
    }),
    prisma.meterReading.findMany({
      where: {
        tenantId: {
          in: contracts.map((contract) => contract.tenantId),
        },
        readingDate: {
          lte: issueDate,
        },
        invoiceItem: null,
        meter: {
          isShared: false,
          propertyId: {
            in: contracts.map((contract) => contract.property.id),
          },
        },
      },
      orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        readingDate: true,
        consumption: true,
        ratePerUnit: true,
        totalAmount: true,
        tenantId: true,
        meter: {
          select: {
            propertyId: true,
            meterCode: true,
            utilityType: true,
          },
        },
      },
    }),
    prisma.cOSAAllocation.findMany({
      where: {
        contractId: {
          in: contracts.map((contract) => contract.id),
        },
        invoiceItem: null,
        cosa: {
          billingDate: {
            lte: issueDate,
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        contractId: true,
        percentage: true,
        computedAmount: true,
        cosa: {
          select: {
            id: true,
            description: true,
            billingDate: true,
            calculationMode: true,
            quantity: true,
            unitRate: true,
            meter: {
              select: {
                meterCode: true,
                utilityType: true,
              },
            },
          },
        },
      },
    }),
    prisma.deferredInvoiceBalance.findMany({
      where: {
        contractId: {
          in: contracts.map((contract) => contract.id),
        },
        status: "OPEN",
      },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        contractId: true,
        tenantId: true,
        sourceDescription: true,
        deferredAmount: true,
        sourceItemType: true,
        sourceInvoice: {
          select: {
            id: true,
            invoiceNumber: true,
            billingPeriodStart: true,
            billingPeriodEnd: true,
          },
        },
      },
    }),
  ]);

  const existingPeriodsByContract = new Map<string, Set<string>>();
  const existingMonthsByContract = new Map<string, Set<string>>();

  for (const invoice of existingInvoices) {
    const key = getBillingCycleKey(
      invoice.billingPeriodStart,
      invoice.billingPeriodEnd
    );
    const monthKey = getBillingMonthKey(invoice.billingPeriodStart);
    const periods = existingPeriodsByContract.get(invoice.contractId) ?? new Set<string>();
    const months = existingMonthsByContract.get(invoice.contractId) ?? new Set<string>();
    periods.add(key);
    months.add(monthKey);
    existingPeriodsByContract.set(invoice.contractId, periods);
    existingMonthsByContract.set(invoice.contractId, months);
  }

  const selectedCycleEntries: Array<{
    selectionKey: string;
    contract: (typeof contracts)[number];
    cycle: {
      start: Date;
      end: Date;
    };
    cycleLabel: string;
    rentAmount: number;
    baseLines: InvoiceGenerationBaseLine[];
    lineAdjustmentsByLineId: Map<string, InvoiceGenerationLineAdjustment>;
    invoiceAdjustments: InvoiceAdjustmentInput[];
    oneTimeSecurityDepositCharge: number;
    freeRentConcessionAmount: number;
    advanceRentCreditAmount: number;
    securityDepositMonths: number;
  }> = [];
  const matchedSelectedCycleKeys = new Set<string>();
  const matchedSelectedReadingKeys = new Set<string>();
  const matchedLineAdjustments = new Set<string>();
  const matchedInvoiceAdjustments = new Set<string>();

  for (const contract of contracts) {
    const missingCycles = filterCyclesWithoutInvoicedMonths(
      findNextCompletedBillingCycles({
        anchorDate: contract.paymentStartDate,
        contractEndDate: contract.endDate,
        issueDate,
        existingPeriods: existingPeriodsByContract.get(contract.id) ?? new Set<string>(),
        includeCurrentCycle: true,
        includeNextCycleInIssueMonth: true,
      }),
      existingMonthsByContract.get(contract.id) ?? new Set<string>()
    ).filter((cycle) => cycle.end >= cutoffDate);
    const baseRent = Number(contract.monthlyRent.toString());
    const advanceRentMonths =
      contract.advanceRentMonths > 0
        ? contract.advanceRentMonths
        : deriveWholeMonths(Number(contract.advanceRent.toString()), baseRent);
    const securityDepositMonths =
      contract.securityDepositMonths > 0
        ? contract.securityDepositMonths
        : deriveWholeMonths(Number(contract.securityDeposit.toString()), baseRent);
    const totalCycleCount = getContractCycleCount(
      contract.paymentStartDate,
      contract.endDate
    );
    const advanceApplicationCycleIndexes = buildAdvanceApplicationCycleIndexes({
      totalCycles: totalCycleCount,
      freeRentCycles: contract.freeRentCycles,
      advanceRentMonths,
      advanceRentApplication: contract.advanceRentApplication,
      advanceRentFirstMonths: contract.advanceRentFirstMonths,
      advanceRentLastMonths: contract.advanceRentLastMonths,
    });

    const contractCharges = recurringCharges.filter(
      (charge) => charge.contractId === contract.id
    );

    const contractReadings = readings.filter(
      (reading) =>
        reading.tenantId === contract.tenantId &&
        reading.meter.propertyId === contract.property.id
    );
    const contractCosaAllocations = cosaAllocations.filter(
      (allocation) => allocation.contractId === contract.id
    );

    for (const cycle of missingCycles) {
      const selectionKey = getInvoiceGenerationSelectionKey(
        contract.id,
        cycle.start,
        cycle.end
      );

      if (!selectedCycleKeys.has(selectionKey)) {
        continue;
      }

      matchedSelectedCycleKeys.add(selectionKey);
      const cycleIndex = getBillingCycleIndex(contract.paymentStartDate, cycle.start);
      const utilityBillingWindow = getUtilityBillingWindowForCycle({
        anchorDate: contract.paymentStartDate,
        cycleStart: cycle.start,
        issueDate,
      });

      const cycleCharges = contractCharges.filter((charge) =>
        cycleOverlapsRange(cycle, charge.effectiveStartDate, charge.effectiveEndDate)
      );

      const cycleReadings = contractReadings.filter(
        (reading) =>
          utilityBillingWindow != null &&
          isReadingInUtilityBillingWindow(reading.readingDate, utilityBillingWindow)
      );
      const selectedReadingIdsForCycle =
        selectedReadingIdsByCycle.get(selectionKey) ?? new Set<string>();
      const selectedCycleReadings = cycleReadings.filter((reading) =>
        selectedReadingIdsForCycle.has(reading.id)
      );

      for (const reading of selectedCycleReadings) {
        matchedSelectedReadingKeys.add(
          buildReadingSelectionKey(selectionKey, reading.id)
        );
      }
      const cycleCosaAllocations = contractCosaAllocations.filter(
        (allocation) => {
          const targetCycle = findCosaTargetBillingCycle({
            billingDate: allocation.cosa.billingDate,
            issueDate,
            pendingCycles: missingCycles,
          });

          return (
            targetCycle != null &&
            getBillingCycleKey(targetCycle.start, targetCycle.end) ===
              getBillingCycleKey(cycle.start, cycle.end)
          );
        }
      );

      const rentAmount = calculateAdjustedMonthlyRent({
        baseMonthlyRent: contract.monthlyRent,
        cycleStart: cycle.start,
        adjustments: contract.rentAdjustments,
      });
      const cycleLabel = formatBillingCycleLabel(cycle);
      const utilityServiceCycle = utilityBillingWindow?.serviceCycle ?? null;
      const baseLines = buildInvoiceGenerationBaseLines({
        cycleSelectionKey: selectionKey,
        cycleLabel,
        contractId: contract.id,
        propertyName: contract.property.name,
        cycleStart: cycle.start,
        cycleEnd: cycle.end,
        rentAmount,
        utilityServiceCycle,
        cycleCharges,
        selectedCycleReadings,
        cycleCosaAllocations,
      });
      const oneTimeSecurityDepositCharge =
        cycleIndex === 0 ? Number(contract.securityDeposit.toString()) : 0;
      const isFreeRentCycle =
        cycleIndex > -1 && cycleIndex < contract.freeRentCycles;
      const freeRentConcessionAmount = isFreeRentCycle ? rentAmount : 0;
      const isAdvanceRentApplicationCycle =
        cycleIndex > -1 &&
        !isFreeRentCycle &&
        advanceApplicationCycleIndexes.has(cycleIndex);
      const advanceRentCreditAmount = isAdvanceRentApplicationCycle
        ? Math.min(baseRent, rentAmount)
        : 0;
      const lineAdjustmentsByLineId =
        selectedLineAdjustmentsByCycle.get(selectionKey) ??
        new Map<string, InvoiceGenerationLineAdjustment>();
      const invoiceAdjustments =
        selectedInvoiceAdjustmentsByCycle.get(selectionKey) ?? [];

      for (const [lineId, lineAdjustment] of lineAdjustmentsByLineId) {
        const baseLine = baseLines.find((line) => line.lineId === lineId);

        if (!baseLine) {
          continue;
        }

        const outcome = calculateInvoiceGenerationLineOutcome({
          lineAmount: baseLine.amount,
          adjustment: lineAdjustment,
        });

        if (lineAdjustment.action !== "FULL" && outcome.billedAmount <= 0) {
          return {
            errors: {
              lineAdjustments: [
                "Adjusted invoice lines must still leave some amount billed now.",
              ],
            },
            message: "Invoice line reduction is too large.",
          };
        }

        matchedLineAdjustments.add(`${selectionKey}::${lineId}`);
      }


      for (const adjustment of invoiceAdjustments) {
        if (
          adjustment.targetLineId !== WHOLE_INVOICE_TARGET &&
          !baseLines.some((line) => line.lineId === adjustment.targetLineId)
        ) {
          continue;
        }

        matchedInvoiceAdjustments.add(adjustment.id);
      }

      selectedCycleEntries.push({
        selectionKey,
        contract,
        cycle,
        cycleLabel,
        rentAmount,
        baseLines,
        lineAdjustmentsByLineId,
        invoiceAdjustments,
        oneTimeSecurityDepositCharge,
        freeRentConcessionAmount,
        advanceRentCreditAmount,
        securityDepositMonths,
      });
    }
  }

  if (matchedSelectedCycleKeys.size !== selectedCycleKeys.size) {
    return {
      errors: {
        cycleSelections: [
          "One or more selected invoices are no longer eligible. Refresh and try again.",
        ],
      },
      message: "Invoice selection is out of date.",
    };
  }

  if (matchedSelectedReadingKeys.size !== submittedReadingSelectionKeys.size) {
    return {
      errors: {
        readingSelections: [
          "One or more selected utility readings are no longer eligible. Refresh and try again.",
        ],
      },
      message: "Utility reading selection is out of date.",
    };
  }

  if (matchedLineAdjustments.size !== validatedFields.data.lineAdjustments.length) {
    return {
      errors: {
        lineAdjustments: [
          "One or more invoice line adjustments are no longer eligible. Refresh and try again.",
        ],
      },
      message: "Invoice line selection is out of date.",
    };
  }


  if (
    matchedInvoiceAdjustments.size !== validatedFields.data.invoiceAdjustments.length
  ) {
    return {
      errors: {
        invoiceAdjustments: [
          "One or more additions or deductions target an unavailable invoice line.",
        ],
      },
      message: "Invoice adjustment selection is out of date.",
    };
  }

  if (selectedCycleEntries.length === 0) {
    return {
      message:
        "No selected billing months were eligible for invoice generation.",
    };
  }

  const selectedCycleInfo: InvoiceGenerationSelectedCycle[] = selectedCycleEntries.map(
    (entry) => ({
      cycleSelectionKey: entry.selectionKey,
      contractId: entry.contract.id,
      start: entry.cycle.start,
      end: entry.cycle.end,
    })
  );
  const persistedDeferredBalanceByKey = new Map(
    deferredBalances.map((balance) => [
      buildPersistedCarryForwardKey(balance.id),
      {
        ...balance,
        deferredAmount: Number(balance.deferredAmount.toString()),
      } satisfies InvoiceGenerationPersistedDeferredBalance,
    ])
  );
  const persistedCarryForwardSources: InvoiceGenerationCarryForwardSource[] =
    deferredBalances.map((balance) => ({
      carryForwardKey: buildPersistedCarryForwardKey(balance.id),
      contractId: balance.contractId,
      availableAfter: balance.sourceInvoice.billingPeriodEnd,
      amount: Number(balance.deferredAmount.toString()),
      sourceLabel: `${balance.sourceDescription} · ${balance.sourceInvoice.invoiceNumber}`,
    }));
  const syntheticCarryForwardSources: InvoiceGenerationCarryForwardSource[] =
    selectedCycleEntries.flatMap((entry) =>
      entry.baseLines.flatMap((line) => {
        const lineAdjustment = entry.lineAdjustmentsByLineId.get(line.lineId);

        if (!lineAdjustment) {
          return [];
        }

        const outcome = calculateInvoiceGenerationLineOutcome({
          lineAmount: line.amount,
          adjustment: lineAdjustment,
        });

        if (outcome.deferredAmount <= 0) {
          return [];
        }

        return [
          {
            carryForwardKey: buildSyntheticCarryForwardKey(line.lineId),
            contractId: entry.contract.id,
            availableAfter: entry.cycle.end,
            amount: outcome.deferredAmount,
            sourceLabel: buildDeferredBalanceSourceDescription({
              lineLabel: line.label,
              cycleLabel: entry.cycleLabel,
            }),
          },
        ];
      })
    );
  const carryForwardAssignments = buildCarryForwardAssignments({
    selectedCycles: selectedCycleInfo,
    sources: [...persistedCarryForwardSources, ...syntheticCarryForwardSources],
  });
  const matchedCarryForwardSelections = new Set<string>();

  for (const selection of validatedFields.data.carryForwardSelections) {
    const assignedSources =
      carryForwardAssignments.get(selection.cycleSelectionKey) ?? [];

    if (
      assignedSources.some(
        (source) => source.carryForwardKey === selection.carryForwardKey
      )
    ) {
      matchedCarryForwardSelections.add(
        `${selection.cycleSelectionKey}::${selection.carryForwardKey}`
      );
    }
  }

  if (
    matchedCarryForwardSelections.size !==
    validatedFields.data.carryForwardSelections.length
  ) {
    return {
      errors: {
        carryForwardSelections: [
          "One or more deferred balances are no longer eligible for this invoice run.",
        ],
      },
      message: "Deferred balance selection is out of date.",
    };
  }

  for (const entry of selectedCycleEntries) {
    const selectedCarryForwardKeys =
      selectedCarryForwardKeysByCycle.get(entry.selectionKey) ?? new Set<string>();
    const carryForwardAmount = (carryForwardAssignments.get(entry.selectionKey) ?? [])
      .filter((source) => selectedCarryForwardKeys.has(source.carryForwardKey))
      .reduce((sum, source) => sum + source.amount, 0);
    const preAdjustmentTotal =
      entry.baseLines.reduce((sum, line) => sum + line.amount, 0) +
      entry.oneTimeSecurityDepositCharge +
      carryForwardAmount -
      entry.freeRentConcessionAmount -
      entry.advanceRentCreditAmount;
    let additions = 0;
    let deductions = 0;
    const deductionByTarget = new Map<string, number>();
    const legacyLineReduction = entry.baseLines.reduce((sum, line) => {
      const lineAdjustment = entry.lineAdjustmentsByLineId.get(line.lineId);

      if (!lineAdjustment) {
        return sum;
      }

      return (
        sum +
        calculateInvoiceGenerationLineOutcome({
          lineAmount: line.amount,
          adjustment: lineAdjustment,
        }).reductionAmount
      );
    }, 0);

    for (const adjustment of entry.invoiceAdjustments) {
      const targetLine = entry.baseLines.find(
        (line) => line.lineId === adjustment.targetLineId
      );
      const basisAmount = targetLine?.amount ?? preAdjustmentTotal;
      const amount = calculateInvoiceAdjustmentAmount({
        valueType: adjustment.valueType,
        value: adjustment.value,
        basisAmount,
      });

      if (adjustment.adjustmentType === "DEDUCTION" && amount > basisAmount) {
        return {
          errors: {
            invoiceAdjustments: [
              `Deduction “${adjustment.label}” exceeds its ${targetLine?.label ?? "invoice"} target.`,
            ],
          },
          message: "Invoice deduction is too large.",
        };
      }

      if (adjustment.adjustmentType === "ADDITION") {
        additions += amount;
      } else {
        deductions += amount;
        deductionByTarget.set(
          adjustment.targetLineId,
          (deductionByTarget.get(adjustment.targetLineId) ?? 0) + amount
        );
      }
    }

    for (const [targetLineId, targetDeductions] of deductionByTarget) {
      const targetLine = entry.baseLines.find(
        (line) => line.lineId === targetLineId
      );
      const targetAmount = targetLine?.amount ?? preAdjustmentTotal;

      if (targetDeductions > targetAmount) {
        return {
          errors: {
            invoiceAdjustments: [
              `Combined deductions exceed the ${targetLine?.label ?? "invoice"} target.`,
            ],
          },
          message: "Combined invoice deductions are too large.",
        };
      }
    }

    if (preAdjustmentTotal - legacyLineReduction + additions - deductions < 0) {
      return {
        errors: {
          invoiceAdjustments: [
            "Combined deductions cannot make an invoice total negative.",
          ],
        },
        message: "Combined invoice deductions are too large.",
      };
    }
  }

  try {
    const sortedCycleEntries = [...selectedCycleEntries].sort((left, right) => {
      if (left.cycle.start.getTime() !== right.cycle.start.getTime()) {
        return left.cycle.start.getTime() - right.cycle.start.getTime();
      }

      return left.selectionKey.localeCompare(right.selectionKey);
    });

    await prisma.$transaction(async (tx) => {
      const generatedDeferredBalanceByKey = new Map<
        string,
        GeneratedDeferredBalanceRecord
      >();

      for (const entry of sortedCycleEntries) {
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber: buildInvoiceNumber(
              issueDate,
              entry.contract.property.propertyCode
            ),
            contractId: entry.contract.id,
            tenantId: entry.contract.tenantId,
            publicAccessCode: generateInvoiceAccessCode(),
            issueDate,
            dueDate,
            billingPeriodStart: entry.cycle.start,
            billingPeriodEnd: entry.cycle.end,
            subtotal: toMoney(0),
            additionalCharges: toMoney(0),
            discount: toMoney(0),
            totalAmount: toMoney(0),
            balanceDue: toMoney(0),
            status: "DRAFT",
          },
        });

        const createdItemMeta: Array<{
          itemType: string;
          amount: number;
        }> = [];
        const createdBaseItemIdByLineId = new Map<string, string>();
        const noteLines: string[] = [];
        let discountTotal = 0;

        const createAdjustmentRecord = async (params: {
          signedAmount: number;
          label: string;
          source: "MANUAL" | "SYSTEM" | "BACKLOG";
          valueType?: "FIXED" | "PERCENTAGE";
          enteredValue?: number;
          targetInvoiceItemId?: string | null;
          createdById?: string | null;
          countsAsDiscount?: boolean;
        }) => {
          const adjustmentItem = await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              itemType: "ADJUSTMENT",
              description: params.label,
              quantity: toMoney(1),
              unitPrice: toMoney(params.signedAmount),
              amount: toMoney(params.signedAmount),
            },
          });

          await tx.invoiceAdjustment.create({
            data: {
              invoiceId: invoice.id,
              adjustmentInvoiceItemId: adjustmentItem.id,
              targetInvoiceItemId: params.targetInvoiceItemId ?? null,
              adjustmentType:
                params.signedAmount < 0 ? "DEDUCTION" : "ADDITION",
              valueType: params.valueType ?? "FIXED",
              enteredValue: toMoney(
                params.enteredValue ?? Math.abs(params.signedAmount)
              ),
              calculatedAmount: toMoney(Math.abs(params.signedAmount)),
              label: params.label,
              source: params.source,
              createdById: params.createdById ?? null,
            },
          });

          createdItemMeta.push({
            itemType: "ADJUSTMENT",
            amount: params.signedAmount,
          });

          if (params.signedAmount < 0 && params.countsAsDiscount) {
            discountTotal += Math.abs(params.signedAmount);
          }

          return adjustmentItem;
        };

        for (const line of entry.baseLines) {
          const createdItem = await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              itemType: line.type,
              description: line.description,
              quantity: toMoney(line.quantity),
              unitPrice: toMoney(line.unitPrice),
              amount: toMoney(line.amount),
              contractRecurringChargeId: line.contractRecurringChargeId,
              meterReadingId: line.meterReadingId,
              cosaAllocationId: line.cosaAllocationId,
            },
          });

          createdBaseItemIdByLineId.set(line.lineId, createdItem.id);
          createdItemMeta.push({
            itemType: line.type,
            amount: line.amount,
          });
        }

        if (entry.oneTimeSecurityDepositCharge > 0) {
          await createAdjustmentRecord({
            signedAmount: entry.oneTimeSecurityDepositCharge,
            label: `Security deposit · ${entry.securityDepositMonths} month(s)`,
            source: "SYSTEM",
          });
        }

        const selectedCarryForwardKeys =
          selectedCarryForwardKeysByCycle.get(entry.selectionKey) ?? new Set<string>();

        for (const source of carryForwardAssignments.get(entry.selectionKey) ?? []) {
          if (!selectedCarryForwardKeys.has(source.carryForwardKey)) {
            continue;
          }

          const parsedKey = parseCarryForwardKey(source.carryForwardKey);

          if (!parsedKey) {
            continue;
          }

          const deferredBalanceRecord =
            parsedKey.kind === "persisted"
              ? persistedDeferredBalanceByKey.get(source.carryForwardKey) ?? null
              : generatedDeferredBalanceByKey.get(source.carryForwardKey) ?? null;

          if (!deferredBalanceRecord) {
            continue;
          }

          const arrearsItem = await tx.invoiceItem.create({
            data: {
              invoiceId: invoice.id,
              itemType: "ARREARS",
              description: buildCarryForwardArrearsDescription({
                invoiceNumber: deferredBalanceRecord.sourceInvoice.invoiceNumber,
                sourceDescription: deferredBalanceRecord.sourceDescription,
              }),
              quantity: toMoney(1),
              unitPrice: toMoney(deferredBalanceRecord.deferredAmount),
              amount: toMoney(deferredBalanceRecord.deferredAmount),
            },
          });

          await tx.deferredInvoiceBalance.update({
            where: { id: deferredBalanceRecord.id },
            data: {
              status: "APPLIED",
              resolvedInvoiceId: invoice.id,
              resolvedInvoiceItemId: arrearsItem.id,
            },
          });

          createdItemMeta.push({
            itemType: "ARREARS",
            amount: deferredBalanceRecord.deferredAmount,
          });
        }

        if (entry.freeRentConcessionAmount > 0) {
          await createAdjustmentRecord({
            signedAmount: -entry.freeRentConcessionAmount,
            label: `Free rent concession · ${entry.cycleLabel}`,
            source: "SYSTEM",
            countsAsDiscount: true,
          });
        }

        if (entry.advanceRentCreditAmount > 0) {
          await createAdjustmentRecord({
            signedAmount: -entry.advanceRentCreditAmount,
            label: `Advance rent applied · ${entry.cycleLabel}`,
            source: "SYSTEM",
            countsAsDiscount: true,
          });
        }

        const preManualAdjustmentTotal = createdItemMeta.reduce(
          (sum, item) => sum + item.amount,
          0
        );

        for (const adjustment of entry.invoiceAdjustments) {
          const targetLine = entry.baseLines.find(
            (line) => line.lineId === adjustment.targetLineId
          );
          const basisAmount = targetLine?.amount ?? preManualAdjustmentTotal;
          const calculatedAmount = calculateInvoiceAdjustmentAmount({
            valueType: adjustment.valueType,
            value: adjustment.value,
            basisAmount,
          });
          const signedAmount =
            adjustment.adjustmentType === "DEDUCTION"
              ? -calculatedAmount
              : calculatedAmount;

          await createAdjustmentRecord({
            signedAmount,
            label: adjustment.label,
            source: "MANUAL",
            valueType: adjustment.valueType,
            enteredValue: adjustment.value,
            targetInvoiceItemId:
              adjustment.targetLineId === WHOLE_INVOICE_TARGET
                ? null
                : createdBaseItemIdByLineId.get(adjustment.targetLineId) ?? null,
            createdById: user.id,
            countsAsDiscount: adjustment.adjustmentType === "DEDUCTION",
          });
        }

        for (const line of entry.baseLines) {
          const lineAdjustment = entry.lineAdjustmentsByLineId.get(line.lineId);

          if (!lineAdjustment || lineAdjustment.action === "FULL") {
            continue;
          }

          const outcome = calculateInvoiceGenerationLineOutcome({
            lineAmount: line.amount,
            adjustment: lineAdjustment,
          });

          await createAdjustmentRecord({
            signedAmount: -outcome.reductionAmount,
            label: buildInvoiceAdjustmentDescription({
              lineLabel: line.label,
              cycleLabel: entry.cycleLabel,
              action: lineAdjustment.action,
            }),
            source: "MANUAL",
            valueType:
              lineAdjustment.valueType === "PERCENT" ? "PERCENTAGE" : "FIXED",
            enteredValue: lineAdjustment.value,
            targetInvoiceItemId: createdBaseItemIdByLineId.get(line.lineId) ?? null,
            createdById: user.id,
            countsAsDiscount: outcome.discountAmount > 0,
          });

          if (outcome.discountAmount > 0) {
            noteLines.push(
              buildDiscountNote({
                lineLabel: line.label,
                cycleLabel: entry.cycleLabel,
                discountAmount: outcome.discountAmount,
              })
            );
          }

          if (outcome.deferredAmount > 0) {
            noteLines.push(
              buildDeferredBalanceNote({
                lineLabel: line.label,
                cycleLabel: entry.cycleLabel,
                deferredAmount: outcome.deferredAmount,
              })
            );

            const deferredBalance = await tx.deferredInvoiceBalance.create({
              data: {
                contractId: entry.contract.id,
                tenantId: entry.contract.tenantId,
                sourceInvoiceId: invoice.id,
                sourceInvoiceItemId:
                  createdBaseItemIdByLineId.get(line.lineId) ?? "",
                sourceDescription: buildDeferredBalanceSourceDescription({
                  lineLabel: line.label,
                  cycleLabel: entry.cycleLabel,
                }),
                sourceItemType: line.type,
                originalAmount: toMoney(line.amount),
                deferredAmount: toMoney(outcome.deferredAmount),
                status: "OPEN",
              },
            });

            generatedDeferredBalanceByKey.set(
              buildSyntheticCarryForwardKey(line.lineId),
              {
                id: deferredBalance.id,
                contractId: entry.contract.id,
                tenantId: entry.contract.tenantId,
                sourceDescription: deferredBalance.sourceDescription,
                deferredAmount: outcome.deferredAmount,
                sourceInvoice: {
                  id: invoice.id,
                  invoiceNumber: invoice.invoiceNumber,
                  billingPeriodStart: entry.cycle.start,
                  billingPeriodEnd: entry.cycle.end,
                },
              }
            );
          }
        }

        const subtotal = createdItemMeta
          .filter((item) => item.itemType === "RENT")
          .reduce((sum, item) => sum + item.amount, 0);
        const additionalCharges = createdItemMeta
          .filter((item) => item.itemType !== "RENT")
          .reduce((sum, item) => sum + item.amount, 0);
        const totalAmount = subtotal + additionalCharges;
        const balanceDue = Math.max(0, totalAmount);

        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            subtotal: toMoney(subtotal),
            additionalCharges: toMoney(additionalCharges),
            discount: toMoney(discountTotal),
            totalAmount: toMoney(totalAmount),
            balanceDue: toMoney(balanceDue),
            status: getInvoiceStatusFromBalance(balanceDue, false),
            notes: noteLines.length > 0 ? noteLines.join("\n") : null,
          },
        });
      }
    });
  } catch {
    return {
      message:
        "Invoices could not be generated. Check for duplicate billing months and try again.",
    };
  }

  revalidateBillingViews();
  redirect(
    withToast("/billing", {
      intent: "success",
      title: "Invoices generated",
      description: `Generated ${selectedCycleEntries.length} invoice cycle(s).`,
    }),
    RedirectType.replace
  );
}

export async function createCosaAction(
  _previousState: CosaFormState,
  formData: FormData
): Promise<CosaFormState> {
  await requireCapability("MANAGE_COSA");

  const payload = getCosaPayload(formData);
  const parseError = getCosaParseError(payload);

  if (parseError) {
    return parseError;
  }

  const validatedFields = cosaSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted COSA fields and try again.",
    };
  }

  const contractIds = validatedFields.data.allocations.flatMap((allocation) =>
    allocation.contractId ? [allocation.contractId] : []
  );
  const selectionValidation = await validateCosaSelections({
    propertyId: validatedFields.data.propertyId,
    meterId: validatedFields.data.meterId,
    meterReadingId: validatedFields.data.meterReadingId,
    contractIds,
  });

  if (selectionValidation.errors) {
    return {
      errors: selectionValidation.errors,
      message: "COSA selections are invalid.",
    };
  }

  if (
    validatedFields.data.allocationType === "BY_AREA" &&
    selectionValidation.contracts.some(
      (contract) =>
        !contract.property.size || Number(contract.property.size.toString()) <= 0
    )
  ) {
    return {
      errors: {
        allocations: [
          "Every selected contract must have a property size before using area-based allocation.",
        ],
      },
      message: "COSA area allocation needs property sizes.",
    };
  }

  let calculatedAllocations;
  const resolvedTotalAmount = selectionValidation.meterReading
    ? Number(selectionValidation.meterReading.totalAmount.toString())
    : Number(validatedFields.data.totalAmount);

  try {
    const contractMap = new Map(
      selectionValidation.contracts.map((contract) => [contract.id, contract])
    );

    calculatedAllocations = calculateCosaAllocations({
      allocationType: validatedFields.data.allocationType,
      totalAmount: resolvedTotalAmount,
      entries: validatedFields.data.allocations.map((allocation) => {
        const contract = allocation.contractId
          ? contractMap.get(allocation.contractId)
          : undefined;

        return {
          contractId: allocation.entryId,
          percentage:
            allocation.percentage && allocation.percentage !== ""
              ? Number(allocation.percentage)
              : null,
          unitCount:
            allocation.unitCount && allocation.unitCount !== ""
              ? Number(allocation.unitCount)
              : null,
          amount:
            allocation.amount && allocation.amount !== ""
              ? Number(allocation.amount)
              : null,
          basisValue: contract?.property.size
            ? Number(contract.property.size.toString())
            : null,
        };
      }),
    });
  } catch (error) {
    return {
      errors: {
        allocations: [
          error instanceof Error
            ? error.message
            : "COSA allocations could not be calculated.",
        ],
      },
      message: "COSA allocations are invalid.",
    };
  }

  try {
    await prisma.cOSA.create({
      data: {
        propertyId: validatedFields.data.propertyId,
        meterId: validatedFields.data.meterId ?? null,
        meterReadingId: validatedFields.data.meterReadingId ?? null,
        description: validatedFields.data.description,
        totalAmount: toMoney(resolvedTotalAmount),
        calculationMode: validatedFields.data.calculationMode,
        quantity:
          validatedFields.data.quantity && validatedFields.data.quantity !== ""
            ? toMoney(Number(validatedFields.data.quantity))
            : null,
        unitRate:
          validatedFields.data.unitRate && validatedFields.data.unitRate !== ""
            ? toMoney(Number(validatedFields.data.unitRate))
            : null,
        billingDate: endOfDay(new Date(validatedFields.data.billingDate)),
        allocationType: validatedFields.data.allocationType,
        allocations: {
          create: calculatedAllocations.map((allocation, index) => {
            const sourceEntry = validatedFields.data.allocations[index];

            return {
              contractId: sourceEntry?.contractId || null,
              helperLabel: sourceEntry?.helperLabel?.trim() || null,
              percentage: toMoney(allocation.percentage),
              unitCount:
                sourceEntry?.unitCount && sourceEntry.unitCount !== ""
                  ? Number(sourceEntry.unitCount)
                  : null,
              computedAmount: toMoney(allocation.computedAmount),
            };
          }),
        },
      },
    });
  } catch {
    return {
      message: "COSA record could not be saved. Try again.",
    };
  }

  revalidateBillingViews();
  redirect(
    validatedFields.data.successRedirectTo?.startsWith(
      "/utilities/readings/handoff?ids="
    )
      ? validatedFields.data.successRedirectTo
      : "/billing/cosa",
    RedirectType.replace
  );
}

export async function updateCosaAction(
  cosaId: string,
  _previousState: CosaFormState,
  formData: FormData
): Promise<CosaFormState> {
  await requireCapability("MANAGE_COSA");

  const existingCosa = await prisma.cOSA.findUnique({
    where: { id: cosaId },
    select: {
      id: true,
      allocations: {
        select: {
          contractId: true,
          invoiceItem: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  if (!existingCosa) {
    return {
      message: "COSA record no longer exists.",
    };
  }

  if (existingCosa.allocations.some((allocation) => allocation.invoiceItem)) {
    return {
      message: "Billed COSA records can no longer be edited.",
    };
  }

  const payload = getCosaPayload(formData);
  const parseError = getCosaParseError(payload);

  if (parseError) {
    return parseError;
  }

  const validatedFields = cosaSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted COSA fields and try again.",
    };
  }

  const contractIds = validatedFields.data.allocations.flatMap((allocation) =>
    allocation.contractId ? [allocation.contractId] : []
  );
  const selectionValidation = await validateCosaSelections({
    propertyId: validatedFields.data.propertyId,
    meterId: validatedFields.data.meterId,
    meterReadingId: validatedFields.data.meterReadingId,
    contractIds,
    editableContractIds: existingCosa.allocations.flatMap((allocation) =>
      allocation.contractId ? [allocation.contractId] : []
    ),
    editableCosaId: existingCosa.id,
  });

  if (selectionValidation.errors) {
    return {
      errors: selectionValidation.errors,
      message: "COSA selections are invalid.",
    };
  }

  if (
    validatedFields.data.allocationType === "BY_AREA" &&
    selectionValidation.contracts.some(
      (contract) =>
        !contract.property.size || Number(contract.property.size.toString()) <= 0
    )
  ) {
    return {
      errors: {
        allocations: [
          "Every selected contract must have a property size before using area-based allocation.",
        ],
      },
      message: "COSA area allocation needs property sizes.",
    };
  }

  let calculatedAllocations;
  const resolvedTotalAmount = selectionValidation.meterReading
    ? Number(selectionValidation.meterReading.totalAmount.toString())
    : Number(validatedFields.data.totalAmount);

  try {
    const contractMap = new Map(
      selectionValidation.contracts.map((contract) => [contract.id, contract])
    );

    calculatedAllocations = calculateCosaAllocations({
      allocationType: validatedFields.data.allocationType,
      totalAmount: resolvedTotalAmount,
      entries: validatedFields.data.allocations.map((allocation) => {
        const contract = allocation.contractId
          ? contractMap.get(allocation.contractId)
          : undefined;

        return {
          contractId: allocation.entryId,
          percentage:
            allocation.percentage && allocation.percentage !== ""
              ? Number(allocation.percentage)
              : null,
          unitCount:
            allocation.unitCount && allocation.unitCount !== ""
              ? Number(allocation.unitCount)
              : null,
          amount:
            allocation.amount && allocation.amount !== ""
              ? Number(allocation.amount)
              : null,
          basisValue: contract?.property.size
            ? Number(contract.property.size.toString())
            : null,
        };
      }),
    });
  } catch (error) {
    return {
      errors: {
        allocations: [
          error instanceof Error
            ? error.message
            : "COSA allocations could not be calculated.",
        ],
      },
      message: "COSA allocations are invalid.",
    };
  }

  try {
    await prisma.cOSA.update({
      where: { id: cosaId },
      data: {
        propertyId: validatedFields.data.propertyId,
        meterId: validatedFields.data.meterId ?? null,
        meterReadingId: validatedFields.data.meterReadingId ?? null,
        description: validatedFields.data.description,
        totalAmount: toMoney(resolvedTotalAmount),
        calculationMode: validatedFields.data.calculationMode,
        quantity:
          validatedFields.data.quantity && validatedFields.data.quantity !== ""
            ? toMoney(Number(validatedFields.data.quantity))
            : null,
        unitRate:
          validatedFields.data.unitRate && validatedFields.data.unitRate !== ""
            ? toMoney(Number(validatedFields.data.unitRate))
            : null,
        billingDate: endOfDay(new Date(validatedFields.data.billingDate)),
        allocationType: validatedFields.data.allocationType,
        allocations: {
          deleteMany: {},
          create: calculatedAllocations.map((allocation, index) => {
            const sourceEntry = validatedFields.data.allocations[index];

            return {
              contractId: sourceEntry?.contractId || null,
              helperLabel: sourceEntry?.helperLabel?.trim() || null,
              percentage: toMoney(allocation.percentage),
              unitCount:
                sourceEntry?.unitCount && sourceEntry.unitCount !== ""
                  ? Number(sourceEntry.unitCount)
                  : null,
              computedAmount: toMoney(allocation.computedAmount),
            };
          }),
        },
      },
    });
  } catch {
    return {
      message: "COSA record could not be updated. Try again.",
    };
  }

  revalidateBillingViews();
  redirect("/billing/cosa", RedirectType.replace);
}

export async function createCosaTemplateAction(
  _previousState: CosaTemplateFormState,
  formData: FormData
): Promise<CosaTemplateFormState> {
  await requireCapability("MANAGE_COSA");

  const payload = getCosaTemplatePayload(formData);
  const parseError = getCosaTemplateParseError(payload);

  if (parseError) {
    return parseError;
  }

  const validatedFields = cosaTemplateSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Review the COSA template rules below and try again.",
    };
  }

  const contractIds = validatedFields.data.allocations.flatMap((allocation) =>
    allocation.contractId ? [allocation.contractId] : []
  );
  const selectionValidation = await validateCosaSelections({
    propertyId: validatedFields.data.propertyId,
    meterId: validatedFields.data.meterId,
    contractIds,
  });

  if (selectionValidation.errors) {
    return {
      errors: selectionValidation.errors,
      message:
        "One or more template selections are no longer valid. Review property, meter, and tenant entries.",
    };
  }

  if (
    validatedFields.data.allocationType === "BY_AREA" &&
    selectionValidation.contracts.some(
      (contract) =>
        !contract.property.size || Number(contract.property.size.toString()) <= 0
    )
  ) {
    return {
      errors: {
        allocations: [
          "Every selected contract must have a property size before using area-based allocation.",
        ],
      },
      message: "Template area allocation needs property sizes.",
    };
  }

  try {
    await prisma.cosaTemplate.create({
      data: {
        propertyId: validatedFields.data.propertyId,
        meterId: validatedFields.data.meterId ?? null,
        name: validatedFields.data.name,
        allocationType: validatedFields.data.allocationType,
        defaultAmount: validatedFields.data.defaultAmount ?? null,
        calculationMode: validatedFields.data.calculationMode,
        dailyRate: validatedFields.data.dailyRate
          ? toMoney(Number(validatedFields.data.dailyRate))
          : null,
        isActive: validatedFields.data.isActive,
        allocations: {
          create: validatedFields.data.allocations.map((allocation) => ({
            contractId: allocation.contractId || null,
            helperLabel: allocation.helperLabel?.trim() || null,
            percentage:
              allocation.percentage && allocation.percentage !== ""
                ? toMoney(Number(allocation.percentage))
                : null,
            unitCount:
              allocation.unitCount && allocation.unitCount !== ""
                ? Number(allocation.unitCount)
                : null,
            amount:
              allocation.amount && allocation.amount !== ""
                ? toMoney(Number(allocation.amount))
                : null,
          })),
        },
      },
    });
  } catch {
    return {
      message:
        "COSA template could not be saved because the final write failed. Refresh and try again.",
    };
  }

  revalidateBillingViews();
  redirect("/billing/cosa/templates", RedirectType.replace);
}

export async function updateCosaTemplateAction(
  templateId: string,
  _previousState: CosaTemplateFormState,
  formData: FormData
): Promise<CosaTemplateFormState> {
  await requireCapability("MANAGE_COSA");

  const existingTemplate = await prisma.cosaTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      allocations: {
        select: {
          contractId: true,
        },
      },
    },
  });

  if (!existingTemplate) {
    return {
      message: "COSA template no longer exists.",
    };
  }

  const payload = getCosaTemplatePayload(formData);
  const parseError = getCosaTemplateParseError(payload);

  if (parseError) {
    return parseError;
  }

  const validatedFields = cosaTemplateSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Review the COSA template rules below and try again.",
    };
  }

  const contractIds = validatedFields.data.allocations.flatMap((allocation) =>
    allocation.contractId ? [allocation.contractId] : []
  );
  const selectionValidation = await validateCosaSelections({
    propertyId: validatedFields.data.propertyId,
    meterId: validatedFields.data.meterId,
    contractIds,
    editableContractIds: existingTemplate.allocations.flatMap((allocation) =>
      allocation.contractId ? [allocation.contractId] : []
    ),
  });

  if (selectionValidation.errors) {
    return {
      errors: selectionValidation.errors,
      message:
        "One or more template selections are no longer valid. Review property, meter, and tenant entries.",
    };
  }

  if (
    validatedFields.data.allocationType === "BY_AREA" &&
    selectionValidation.contracts.some(
      (contract) =>
        !contract.property.size || Number(contract.property.size.toString()) <= 0
    )
  ) {
    return {
      errors: {
        allocations: [
          "Every selected contract must have a property size before using area-based allocation.",
        ],
      },
      message: "Template area allocation needs property sizes.",
    };
  }

  try {
    await prisma.cosaTemplate.update({
      where: { id: templateId },
      data: {
        propertyId: validatedFields.data.propertyId,
        meterId: validatedFields.data.meterId ?? null,
        name: validatedFields.data.name,
        allocationType: validatedFields.data.allocationType,
        defaultAmount: validatedFields.data.defaultAmount ?? null,
        calculationMode: validatedFields.data.calculationMode,
        dailyRate: validatedFields.data.dailyRate
          ? toMoney(Number(validatedFields.data.dailyRate))
          : null,
        isActive: validatedFields.data.isActive,
        allocations: {
          deleteMany: {},
          create: validatedFields.data.allocations.map((allocation) => ({
            contractId: allocation.contractId || null,
            helperLabel: allocation.helperLabel?.trim() || null,
            percentage:
              allocation.percentage && allocation.percentage !== ""
                ? toMoney(Number(allocation.percentage))
                : null,
            unitCount:
              allocation.unitCount && allocation.unitCount !== ""
                ? Number(allocation.unitCount)
                : null,
            amount:
              allocation.amount && allocation.amount !== ""
                ? toMoney(Number(allocation.amount))
                : null,
          })),
        },
      },
    });
  } catch {
    return {
      message:
        "COSA template changes could not be saved because the final write failed. Refresh and try again.",
    };
  }

  revalidateBillingViews();
  redirect("/billing/cosa/templates", RedirectType.replace);
}

export async function deleteCosaTemplateAction(
  templateId: string,
  _previousState: CosaTemplateFormState,
  _formData: FormData
): Promise<CosaTemplateFormState> {
  void _previousState;
  void _formData;
  await requireCapability("MANAGE_COSA");

  const existingTemplate = await prisma.cosaTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!existingTemplate) {
    return {
      message: "COSA template no longer exists.",
    };
  }

  try {
    await prisma.cosaTemplate.delete({
      where: { id: templateId },
    });
  } catch {
    return {
      message:
        "COSA template could not be deleted. Refresh and try again.",
    };
  }

  revalidateBillingViews();
  redirect(
    withToast("/billing/cosa/templates", {
      intent: "success",
      title: "Template deleted",
      description: `${existingTemplate.name} was permanently deleted.`,
    })
  );
}

export async function createInvoiceBrandingTemplateAction(
  _previousState: InvoiceBrandingTemplateFormState,
  formData: FormData
): Promise<InvoiceBrandingTemplateFormState> {
  await requireCapability("MANAGE_INVOICE_TEMPLATES");

  const payload = getInvoiceBrandingTemplatePayload(formData);
  const validatedFields = invoiceBrandingTemplateSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted invoice template fields and try again.",
    };
  }

  if (
    !(await validateInvoiceBrandingTemplateProperties(
      payload.propertyIds
    ))
  ) {
    return {
      errors: {
        propertyIds: ["Select valid properties for this template."],
      },
      message: "Template property assignments are invalid.",
    };
  }

  const logoInput = await resolveInvoiceTemplateLogoInput(formData);

  if ("error" in logoInput) {
    const logoError = logoInput.error ?? "Template logo is invalid.";

    return {
      errors: {
        logoFile: [logoError],
      },
      message: "Template logo could not be saved.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (validatedFields.data.isDefault) {
        await tx.invoiceBrandingTemplate.updateMany({
          where: {
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      const template = await tx.invoiceBrandingTemplate.create({
        data: {
          name: validatedFields.data.name,
          brandName: validatedFields.data.brandName,
          brandSubtitle: validatedFields.data.brandSubtitle,
          fontFamily: validatedFields.data.fontFamily,
          showBrandName: validatedFields.data.showBrandName,
          showBrandSubtitle: validatedFields.data.showBrandSubtitle,
          invoiceTitlePrefix: validatedFields.data.invoiceTitlePrefix,
          logoUrl: logoInput.logoUrl,
          logoStorageKey: logoInput.logoStorageKey,
          usePropertyLogo: validatedFields.data.usePropertyLogo,
          titleScale: validatedFields.data.titleScale,
          logoScalePercent: validatedFields.data.logoScalePercent,
          brandNameSizePercent: validatedFields.data.brandNameSizePercent,
          brandSubtitleSizePercent: validatedFields.data.brandSubtitleSizePercent,
          tenantNameSizePercent: validatedFields.data.tenantNameSizePercent,
          titleSizePercent: validatedFields.data.titleSizePercent,
          brandNameWeight: validatedFields.data.brandNameWeight,
          tenantNameWeight: validatedFields.data.tenantNameWeight,
          titleWeight: validatedFields.data.titleWeight,
          accentColor: validatedFields.data.accentColor,
          labelColor: validatedFields.data.labelColor,
          valueColor: validatedFields.data.valueColor,
          mutedColor: validatedFields.data.mutedColor,
          panelBackground: validatedFields.data.panelBackground,
          isDefault: validatedFields.data.isDefault,
        },
      });

      if (payload.propertyIds.length > 0) {
        await tx.property.updateMany({
          where: {
            id: {
              in: payload.propertyIds,
            },
          },
          data: {
            invoiceBrandingTemplateId: template.id,
          },
        });
      }
    });
  } catch {
    if (logoInput.logoStorageKey) {
      await removeInvoiceTemplateLogoFile(logoInput.logoStorageKey);
    }

    return {
      message: "Invoice template could not be saved. Try again.",
    };
  }

  revalidateBillingViews();
  redirect("/billing/invoice-templates", RedirectType.replace);
}

export async function updateInvoiceBrandingTemplateAction(
  templateId: string,
  _previousState: InvoiceBrandingTemplateFormState,
  formData: FormData
): Promise<InvoiceBrandingTemplateFormState> {
  await requireCapability("MANAGE_INVOICE_TEMPLATES");

  const existingTemplate = await prisma.invoiceBrandingTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      logoUrl: true,
      logoStorageKey: true,
      properties: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!existingTemplate) {
    return {
      message: "Invoice template no longer exists.",
    };
  }

  const payload = getInvoiceBrandingTemplatePayload(formData);
  const validatedFields = invoiceBrandingTemplateSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted invoice template fields and try again.",
    };
  }

  if (
    !(await validateInvoiceBrandingTemplateProperties(
      payload.propertyIds
    ))
  ) {
    return {
      errors: {
        propertyIds: ["Select valid properties for this template."],
      },
      message: "Template property assignments are invalid.",
    };
  }

  const logoInput = await resolveInvoiceTemplateLogoInput(
    formData,
    existingTemplate
  );

  if ("error" in logoInput) {
    const logoError = logoInput.error ?? "Template logo is invalid.";

    return {
      errors: {
        logoFile: [logoError],
      },
      message: "Template logo could not be updated.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (validatedFields.data.isDefault) {
        await tx.invoiceBrandingTemplate.updateMany({
          where: {
            isDefault: true,
            id: { not: templateId },
          },
          data: {
            isDefault: false,
          },
        });
      }

      await tx.invoiceBrandingTemplate.update({
        where: { id: templateId },
        data: {
          name: validatedFields.data.name,
          brandName: validatedFields.data.brandName,
          brandSubtitle: validatedFields.data.brandSubtitle,
          fontFamily: validatedFields.data.fontFamily,
          showBrandName: validatedFields.data.showBrandName,
          showBrandSubtitle: validatedFields.data.showBrandSubtitle,
          invoiceTitlePrefix: validatedFields.data.invoiceTitlePrefix,
          logoUrl: logoInput.logoUrl,
          logoStorageKey: logoInput.logoStorageKey,
          usePropertyLogo: validatedFields.data.usePropertyLogo,
          titleScale: validatedFields.data.titleScale,
          logoScalePercent: validatedFields.data.logoScalePercent,
          brandNameSizePercent: validatedFields.data.brandNameSizePercent,
          brandSubtitleSizePercent: validatedFields.data.brandSubtitleSizePercent,
          tenantNameSizePercent: validatedFields.data.tenantNameSizePercent,
          titleSizePercent: validatedFields.data.titleSizePercent,
          brandNameWeight: validatedFields.data.brandNameWeight,
          tenantNameWeight: validatedFields.data.tenantNameWeight,
          titleWeight: validatedFields.data.titleWeight,
          accentColor: validatedFields.data.accentColor,
          labelColor: validatedFields.data.labelColor,
          valueColor: validatedFields.data.valueColor,
          mutedColor: validatedFields.data.mutedColor,
          panelBackground: validatedFields.data.panelBackground,
          isDefault: validatedFields.data.isDefault,
        },
      });

      await tx.property.updateMany({
        where: {
          invoiceBrandingTemplateId: templateId,
          id: {
            notIn: payload.propertyIds,
          },
        },
        data: {
          invoiceBrandingTemplateId: null,
        },
      });

      if (payload.propertyIds.length > 0) {
        await tx.property.updateMany({
          where: {
            id: {
              in: payload.propertyIds,
            },
          },
          data: {
            invoiceBrandingTemplateId: templateId,
          },
        });
      }
    });
  } catch {
    if (
      logoInput.logoStorageKey &&
      logoInput.logoStorageKey !== existingTemplate.logoStorageKey
    ) {
      await removeInvoiceTemplateLogoFile(logoInput.logoStorageKey);
    }

    return {
      message: "Invoice template could not be updated. Try again.",
    };
  }

  if (logoInput.replacedStorageKey) {
    await removeInvoiceTemplateLogoFile(logoInput.replacedStorageKey);
  }

  revalidateBillingViews();
  redirect("/billing/invoice-templates", RedirectType.replace);
}

export async function createRecurringChargeAction(
  _previousState: RecurringChargeFormState,
  formData: FormData
): Promise<RecurringChargeFormState> {
  await requireCapability("MANAGE_CHARGES");

  const validatedFields = recurringChargeSchema.safeParse(
    getRecurringChargePayload(formData)
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted recurring charge fields and try again.",
    };
  }

  const contractErrors = await validateRecurringChargeContract(
    validatedFields.data.contractId
  );

  if (contractErrors) {
    return {
      errors: contractErrors,
      message: "Recurring charge contract selection is invalid.",
    };
  }

  try {
    await prisma.contractRecurringCharge.create({
      data: {
        contractId: validatedFields.data.contractId,
        chargeType: validatedFields.data.chargeType,
        label: validatedFields.data.label,
        amount: validatedFields.data.amount,
        descriptionDateDisplayOverride:
          validatedFields.data.descriptionDateDisplayOverride ?? null,
        effectiveStartDate: new Date(validatedFields.data.effectiveStartDate),
        effectiveEndDate: validatedFields.data.effectiveEndDate
          ? new Date(validatedFields.data.effectiveEndDate)
          : null,
        isActive: validatedFields.data.isActive,
      },
    });
  } catch {
    return {
      message: "Recurring charge could not be saved. Try again.",
    };
  }

  revalidateBillingViews();
  redirect("/billing/charges", RedirectType.replace);
}

export async function updateRecurringChargeAction(
  chargeId: string,
  _previousState: RecurringChargeFormState,
  formData: FormData
): Promise<RecurringChargeFormState> {
  await requireCapability("MANAGE_CHARGES");

  const existingCharge = await prisma.contractRecurringCharge.findUnique({
    where: { id: chargeId },
    select: {
      id: true,
      contractId: true,
    },
  });

  if (!existingCharge) {
    return {
      message: "Recurring charge no longer exists.",
    };
  }

  const validatedFields = recurringChargeSchema.safeParse(
    getRecurringChargePayload(formData)
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted recurring charge fields and try again.",
    };
  }

  const contractErrors = await validateRecurringChargeContract(
    validatedFields.data.contractId,
    existingCharge.contractId
  );

  if (contractErrors) {
    return {
      errors: contractErrors,
      message: "Recurring charge contract selection is invalid.",
    };
  }

  try {
    await prisma.contractRecurringCharge.update({
      where: { id: chargeId },
      data: {
        contractId: validatedFields.data.contractId,
        chargeType: validatedFields.data.chargeType,
        label: validatedFields.data.label,
        amount: validatedFields.data.amount,
        descriptionDateDisplayOverride:
          validatedFields.data.descriptionDateDisplayOverride ?? null,
        effectiveStartDate: new Date(validatedFields.data.effectiveStartDate),
        effectiveEndDate: validatedFields.data.effectiveEndDate
          ? new Date(validatedFields.data.effectiveEndDate)
          : null,
        isActive: validatedFields.data.isActive,
      },
    });
  } catch {
    return {
      message: "Recurring charge could not be updated. Try again.",
    };
  }

  revalidateBillingViews();
  redirect("/billing/charges", RedirectType.replace);
}

export async function deactivateRecurringChargeAction(
  chargeId: string,
  _previousState: RecurringChargeFormState,
  _formData: FormData
): Promise<RecurringChargeFormState> {
  void _previousState;
  void _formData;
  await requireCapability("MANAGE_CHARGES");

  const existingCharge = await prisma.contractRecurringCharge.findUnique({
    where: { id: chargeId },
    select: {
      id: true,
      isActive: true,
    },
  });

  if (!existingCharge) {
    return {
      message: "Recurring charge no longer exists.",
    };
  }

  if (!existingCharge.isActive) {
    redirect(
      withToast("/billing/charges", {
        title: "Charge already inactive",
        description: "Recurring charge was already removed from future billing.",
        intent: "info",
      }),
      RedirectType.replace
    );
  }

  try {
    await prisma.contractRecurringCharge.update({
      where: { id: chargeId },
      data: {
        isActive: false,
      },
    });
  } catch {
    return {
      message: "Recurring charge could not be removed. Try again.",
    };
  }

  revalidateBillingViews();
  redirect(
    withToast("/billing/charges", {
      title: "Charge removed",
      description:
        "Recurring charge was removed from future billing. Existing invoices were not changed.",
      intent: "success",
    }),
    RedirectType.replace
  );
}

export async function recordPaymentAction(
  invoiceId: string,
  _previousState: RecordPaymentFormState,
  formData: FormData
): Promise<RecordPaymentFormState> {
  await requireCapability("MANAGE_BILLING");

  const payload = getPaymentPayload(formData);
  const parseError = getPaymentParseError(payload);

  if (parseError) {
    return parseError;
  }

  const validatedFields = paymentRecordingSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted payment fields and try again.",
    };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      contractId: true,
      dueDate: true,
      status: true,
      items: {
        select: {
          id: true,
          amount: true,
          allocations: {
            select: {
              amountAllocated: true,
            },
          },
        },
      },
      payments: {
        select: { id: true },
      },
    },
  });

  if (!invoice) {
    return {
      message: "Invoice no longer exists.",
    };
  }

  if (invoice.status === "VOID") {
    return {
      message: "Void invoices cannot receive payments.",
    };
  }

  const itemMap = buildInvoiceItemMap(invoice);

  const normalizedAllocations = validatedFields.data.allocations
    .map((allocation) => ({
      ...allocation,
      amount: Number(allocation.amount),
    }))
    .filter((allocation) => allocation.amount > 0);

  const allocationErrors = validatePaymentAllocations(
    itemMap,
    normalizedAllocations
  );

  if (allocationErrors.length > 0) {
    return {
      errors: {
        allocations: allocationErrors,
      },
      message: "Payment allocations are invalid.",
    };
  }

  try {
    await persistInvoicePayment({
      invoice,
      allocations: normalizedAllocations,
      paymentDate: validatedFields.data.paymentDate,
      referenceNumber: validatedFields.data.referenceNumber,
      notes: validatedFields.data.notes,
    });
  } catch {
    return {
      message: "Payment could not be recorded. Try again.",
    };
  }

  revalidateBillingViews();
  redirect(
    withToast(`/billing/${invoice.id}`, {
      intent: "success",
      title: "Payment recorded",
      description: `Recorded payment for ${invoice.invoiceNumber}.`,
    }),
    RedirectType.replace
  );
}

export async function bulkRecordFullPaymentAction(
  _previousState: BulkRecordPaymentFormState,
  formData: FormData
): Promise<BulkRecordPaymentFormState> {
  await requireCapability("MANAGE_BILLING");

  const payload = getBulkPaymentPayload(formData);
  const parseError = getBulkPaymentParseError(payload);

  if (parseError) {
    return parseError;
  }

  const validatedFields = bulkPaymentRecordingSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted bulk payment fields and try again.",
    };
  }

  const uniqueInvoiceIds = [...new Set(validatedFields.data.invoiceIds)];
  const invoices = await prisma.invoice.findMany({
    where: {
      id: {
        in: uniqueInvoiceIds,
      },
    },
    select: {
      id: true,
      invoiceNumber: true,
      contractId: true,
      dueDate: true,
      status: true,
      items: {
        select: {
          id: true,
          amount: true,
          allocations: {
            select: {
              amountAllocated: true,
            },
          },
        },
      },
      payments: {
        select: { id: true },
      },
    },
  });

  if (invoices.length !== uniqueInvoiceIds.length) {
    return {
      message: "Some selected invoices no longer exist. Refresh and try again.",
    };
  }

  const invoicesById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const orderedInvoices = uniqueInvoiceIds
    .map((invoiceId) => invoicesById.get(invoiceId))
    .filter((invoice): invoice is NonNullable<typeof invoice> => Boolean(invoice));

  for (const invoice of orderedInvoices) {
    if (invoice.status === "VOID") {
      return {
        message: `Invoice ${invoice.invoiceNumber} is void and cannot receive payments.`,
      };
    }

    const fullAllocations = buildFullRemainingAllocations(invoice);

    if (fullAllocations.length === 0) {
      return {
        message: `Invoice ${invoice.invoiceNumber} no longer has a remaining balance.`,
      };
    }

    const allocationErrors = validatePaymentAllocations(
      buildInvoiceItemMap(invoice),
      fullAllocations
    );

    if (allocationErrors.length > 0) {
      return {
        errors: {
          invoiceIds: allocationErrors,
        },
        message: `Invoice ${invoice.invoiceNumber} could not be settled fully.`,
      };
    }
  }

  try {
    for (const invoice of orderedInvoices) {
      await persistInvoicePayment({
        invoice,
        allocations: buildFullRemainingAllocations(invoice),
        paymentDate: validatedFields.data.paymentDate,
        referenceNumber: validatedFields.data.referenceNumber,
        notes: validatedFields.data.notes,
      });
    }
  } catch {
    return {
      message: "Bulk full payment could not be recorded. Try again.",
    };
  }

  revalidateBillingViews();
  redirect(
    withToast("/billing", {
      intent: "success",
      title: "Invoices fully paid",
      description: `Recorded full payments for ${orderedInvoices.length} invoice${
        orderedInvoices.length === 1 ? "" : "s"
      }.`,
    }),
    RedirectType.replace
  );
}
