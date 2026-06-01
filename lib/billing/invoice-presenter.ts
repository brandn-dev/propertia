import type {
  AllocationType,
  InvoiceDateDisplayMode,
  InvoiceItemDescriptionMode,
} from "@prisma/client";
import { formatBillingCycleMonthLabel } from "@/lib/billing/cycles";
import { RECURRING_CHARGE_TYPE_LABELS } from "@/lib/form-options";
import { formatDate, toNumber } from "@/lib/format";
import { UTILITY_TYPE_LABELS } from "@/lib/form-options";
import {
  formatUtilityQuantity,
  getUtilityUnitLabel,
} from "@/lib/utility-units";

const ITEM_TYPE_LABELS = {
  RENT: "Rent",
  RECURRING_CHARGE: "Recurring charge",
  UTILITY_READING: "Utility reading",
  COSA: "COSA",
  ADJUSTMENT: "Adjustment",
  ARREARS: "Arrears",
} as const;

type TenantShape = {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  invoiceDescriptionDateDisplayDefault: InvoiceDateDisplayMode;
};

type InvoiceDescriptionItemShape = {
  id: string;
  itemType: keyof typeof ITEM_TYPE_LABELS;
  description: string;
  descriptionMode?: InvoiceItemDescriptionMode;
  customDescription?: string | null;
  contractRecurringCharge?: {
    label: string;
    chargeType: keyof typeof RECURRING_CHARGE_TYPE_LABELS;
    descriptionDateDisplayOverride: InvoiceDateDisplayMode | null;
  } | null;
  meterReading?: {
    id: string;
    readingDate: Date;
    previousReading: { toNumber(): number } | number;
    currentReading: { toNumber(): number } | number;
    ratePerUnit: { toNumber(): number } | number;
    consumption: { toNumber(): number } | number;
    totalAmount: { toNumber(): number } | number;
    meter: {
      id: string;
      meterCode: string;
      utilityType: keyof typeof UTILITY_TYPE_LABELS;
    };
  } | null;
  cosaAllocation?: {
    id: string;
    percentage: { toNumber(): number } | number;
    unitCount: number | null;
    computedAmount: { toNumber(): number } | number;
    cosa: {
      id: string;
      description: string;
      billingDate: Date;
      totalAmount: { toNumber(): number } | number;
      allocationType: AllocationType;
      meter?: {
        id: string;
        meterCode: string;
        utilityType: keyof typeof UTILITY_TYPE_LABELS;
      } | null;
      meterReading?: {
        id: string;
        readingDate: Date;
        previousReading: { toNumber(): number } | number;
        currentReading: { toNumber(): number } | number;
        ratePerUnit: { toNumber(): number } | number;
        consumption: { toNumber(): number } | number;
        totalAmount: { toNumber(): number } | number;
        meter: {
          id: string;
          meterCode: string;
          utilityType: keyof typeof UTILITY_TYPE_LABELS;
        };
      } | null;
    };
  } | null;
};

type InvoicePresentationItemShape = InvoiceDescriptionItemShape & {
  quantity: { toNumber(): number } | number;
  unitPrice: { toNumber(): number } | number;
  amount: { toNumber(): number } | number;
  allocations?: Array<{
    id: string;
    amountAllocated: { toNumber(): number } | number;
  }>;
};

type InternalInvoiceShape = {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  subtotal: { toNumber(): number } | number;
  additionalCharges: { toNumber(): number } | number;
  discount: { toNumber(): number } | number;
  totalAmount: { toNumber(): number } | number;
  balanceDue: { toNumber(): number } | number;
  origin: string;
  status: string;
  notes: string | null;
  contract: {
    paymentStartDate: Date;
    property: {
      name: string;
      propertyCode: string;
      logoUrl: string | null;
      invoiceBrandingTemplate: {
        id: string;
        name: string;
        brandName: string;
        brandSubtitle: string;
        invoiceTitlePrefix: string;
        logoUrl: string | null;
        usePropertyLogo: boolean;
        titleScale: "COMPACT" | "STANDARD" | "PROMINENT";
        logoScalePercent: number;
        brandNameSizePercent: number;
        brandSubtitleSizePercent: number;
        tenantNameSizePercent: number;
        titleSizePercent: number;
        brandNameWeight: number;
        tenantNameWeight: number;
        titleWeight: number;
        accentColor: string;
        labelColor: string;
        valueColor: string;
        mutedColor: string;
        panelBackground: string;
        isDefault: boolean;
      } | null;
    };
  };
  tenant: TenantShape;
  items: InvoicePresentationItemShape[];
  payments?: Array<{
    id: string;
    amountPaid: { toNumber(): number } | number;
    paymentDate: Date | null;
    status: string;
    referenceNumber: string | null;
  }>;
};

type PublicInvoiceShape = {
  id: string;
  invoiceNumber: string;
  issueDate: Date;
  dueDate: Date;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  subtotal: { toNumber(): number } | number;
  additionalCharges: { toNumber(): number } | number;
  discount: { toNumber(): number } | number;
  totalAmount: { toNumber(): number } | number;
  balanceDue: { toNumber(): number } | number;
  origin: string;
  status: string;
  notes?: string | null;
  contract: {
    paymentStartDate: Date;
    property: {
      name: string;
      propertyCode: string;
      logoUrl: string | null;
      invoiceBrandingTemplate: {
        id: string;
        name: string;
        brandName: string;
        brandSubtitle: string;
        invoiceTitlePrefix: string;
        logoUrl: string | null;
        usePropertyLogo: boolean;
        titleScale: "COMPACT" | "STANDARD" | "PROMINENT";
        logoScalePercent: number;
        brandNameSizePercent: number;
        brandSubtitleSizePercent: number;
        tenantNameSizePercent: number;
        titleSizePercent: number;
        brandNameWeight: number;
        tenantNameWeight: number;
        titleWeight: number;
        accentColor: string;
        labelColor: string;
        valueColor: string;
        mutedColor: string;
        panelBackground: string;
        isDefault: boolean;
      } | null;
    };
  };
  tenant: TenantShape;
  items: InvoicePresentationItemShape[];
};

type InvoiceDescriptionContext = {
  origin: string;
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
  tenant: TenantShape;
};

export type InvoicePresentationModel = {
  invoiceId: string;
  invoiceNumber: string;
  title: string;
  statusLabel: string;
  originLabel: string;
  propertyCode: string;
  propertyLogoUrl: string | null;
  branding: {
    brandName: string;
    brandSubtitle: string;
    invoiceTitlePrefix: string;
    logoUrl: string | null;
    titleScale: "COMPACT" | "STANDARD" | "PROMINENT";
    logoScalePercent: number;
    brandNameSizePercent: number;
    brandSubtitleSizePercent: number;
    tenantNameSizePercent: number;
    titleSizePercent: number;
    brandNameWeight: number;
    tenantNameWeight: number;
    titleWeight: number;
    accentColor: string;
    labelColor: string;
    valueColor: string;
    mutedColor: string;
    panelBackground: string;
  };
  tenantName: string;
  propertyName: string;
  dueDateLabel: string;
  issueDateLabel: string;
  billingPeriodLabel: string;
  billingAnchorLabel: string;
  notes: string | null;
  totals: {
    subtotal: number;
    additionalCharges: number;
    discount: number;
    totalAmount: number;
    balanceDue: number;
    collectedAmount: number;
  };
  items: Array<{
    id: string;
    itemType: string;
    typeLabel: string;
    description: string;
    quantity: number;
    quantityDisplay?: string;
    unitPrice: number;
    amount: number;
    allocatedAmount?: number;
    remainingAmount?: number;
  }>;
  payments: Array<{
    id: string;
    amountPaid: number;
    paymentDateLabel: string;
    statusLabel: string;
    referenceNumber: string | null;
  }>;
  breakdowns: {
    hasSecondPage: boolean;
    utilityReadings: Array<{
      itemId: string;
      utilityType: keyof typeof UTILITY_TYPE_LABELS;
      utilityTypeLabel: string;
      meterCode: string;
      readingDateLabel: string;
      previousReading: number;
      currentReading: number;
      consumption: number;
      ratePerUnit: number;
      totalAmount: number;
      consumptionLabel: string;
      rateLabel: string;
    }>;
    cosaAllocations: Array<{
      itemId: string;
      description: string;
      billingDateLabel: string;
      sourceTotalAmount: number;
      allocatedAmount: number;
      percentage: number | null;
      unitCount: number | null;
      sourceUtilityTypeLabel: string | null;
      sourceMeterCode: string | null;
      sourceReadingDateLabel: string | null;
      sourcePreviousReadingLabel: string | null;
      sourceCurrentReadingLabel: string | null;
      sourceConsumptionLabel: string | null;
      sourceRateLabel: string | null;
    }>;
  };
};

export function formatTenantName(tenant: TenantShape) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

function formatInvoiceQuantity(value: number) {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getCosaQuantityDisplay(unitCount: number) {
  const formattedCount = formatInvoiceQuantity(unitCount);
  return `${formattedCount} ${unitCount === 1 ? "unit" : "units"}`;
}

function getCosaPercentageDisplay(percentage: number) {
  return `${formatInvoiceQuantity(percentage)}%`;
}

function getCosaAllocationBasisPresentation(
  item: InvoicePresentationItemShape,
  amount: number
) {
  if (item.itemType !== "COSA" || !item.cosaAllocation?.cosa) {
    return null;
  }

  if (
    item.cosaAllocation.cosa.allocationType === "PER_UNIT" &&
    item.cosaAllocation.unitCount != null &&
    item.cosaAllocation.unitCount > 0
  ) {
    return {
      quantity: item.cosaAllocation.unitCount,
      quantityDisplay: getCosaQuantityDisplay(item.cosaAllocation.unitCount),
      unitPrice: Number((amount / item.cosaAllocation.unitCount).toFixed(2)),
    };
  }

  const percentage = toNumber(item.cosaAllocation.percentage);

  if (item.cosaAllocation.cosa.allocationType === "PERCENTAGE" && percentage > 0) {
    return {
      quantity: percentage,
      quantityDisplay: getCosaPercentageDisplay(percentage),
      unitPrice: Number((amount / percentage).toFixed(2)),
    };
  }

  return null;
}

function stripTrailingBillingDateRange(description: string) {
  const withoutIsoRange = description.replace(
    / · \d{4}-\d{2}-\d{2} to \d{4}-\d{2}-\d{2}$/,
    ""
  );

  if (withoutIsoRange !== description) {
    return withoutIsoRange.trim() || null;
  }

  const withoutFormattedRange = description.replace(
    /(?::| ·) [A-Z][a-z]{2,8} \d{1,2}, \d{4} to [A-Z][a-z]{2,8} \d{1,2}, \d{4}$/,
    ""
  );

  if (withoutFormattedRange !== description) {
    return withoutFormattedRange.trim() || null;
  }

  return null;
}

function getRecurringChargeDisplayMode(
  item: InvoiceDescriptionItemShape,
  tenant: TenantShape
) {
  return (
    item.contractRecurringCharge?.descriptionDateDisplayOverride ??
    tenant.invoiceDescriptionDateDisplayDefault
  );
}

function getRecurringChargeLineLabel(item: InvoiceDescriptionItemShape) {
  return item.contractRecurringCharge?.chargeType
    ? RECURRING_CHARGE_TYPE_LABELS[item.contractRecurringCharge.chargeType]
    : item.contractRecurringCharge?.label;
}

function getResolvedInvoiceDateDisplayMode(
  invoice: InvoiceDescriptionContext,
  item: InvoiceDescriptionItemShape
) {
  if (item.descriptionMode === "SHOW") {
    return "SHOW" as const;
  }

  if (item.descriptionMode === "HIDE") {
    return "HIDE" as const;
  }

  if (item.itemType === "RECURRING_CHARGE") {
    return getRecurringChargeDisplayMode(item, invoice.tenant);
  }

  return invoice.tenant.invoiceDescriptionDateDisplayDefault;
}

export function resolveInvoiceItemDescription(
  invoice: InvoiceDescriptionContext,
  item: InvoiceDescriptionItemShape
) {
  if (item.descriptionMode === "CUSTOM" && item.customDescription?.trim()) {
    return item.customDescription.trim();
  }

  const recurringChargeLabel = getRecurringChargeLineLabel(item);
  const utilityReadingLabel =
    item.itemType === "UTILITY_READING" && item.meterReading
      ? `${UTILITY_TYPE_LABELS[item.meterReading.meter.utilityType]} Reading`
      : null;

  if (item.itemType === "RENT") {
    if (invoice.origin !== "GENERATED") {
      return item.description;
    }

    if (getResolvedInvoiceDateDisplayMode(invoice, item) === "SHOW") {
      return `Coverage: ${formatDate(invoice.billingPeriodStart)} to ${formatDate(invoice.billingPeriodEnd)}`;
    }

    return stripTrailingBillingDateRange(item.description) ?? "Monthly rent";
  }

  if (item.itemType === "RECURRING_CHARGE") {
    const recurringChargeDisplayMode = getResolvedInvoiceDateDisplayMode(
      invoice,
      item
    );

    if (recurringChargeDisplayMode === "SHOW") {
      if (recurringChargeLabel) {
        return `${recurringChargeLabel}: ${formatDate(invoice.billingPeriodStart)} to ${formatDate(invoice.billingPeriodEnd)}`;
      }

      const storedBaseDescription = stripTrailingBillingDateRange(item.description);
      return storedBaseDescription
        ? `${storedBaseDescription}: ${formatDate(invoice.billingPeriodStart)} to ${formatDate(invoice.billingPeriodEnd)}`
        : item.description;
    }

    return (
      item.contractRecurringCharge?.label ??
      stripTrailingBillingDateRange(item.description) ??
      item.description
    );
  }

  if (item.itemType === "UTILITY_READING" && utilityReadingLabel) {
    return utilityReadingLabel;
  }

  if (item.itemType === "COSA") {
    return normalizeLegacyCosaDescription(item.description);
  }

  return item.description;
}

export function buildInvoicePresentationModel(
  invoice: InternalInvoiceShape | PublicInvoiceShape
): InvoicePresentationModel {
  const brandingTemplate = invoice.contract.property.invoiceBrandingTemplate;
  const propertyLogoUrl = invoice.contract.property.logoUrl;
  const resolvedLogoUrl = brandingTemplate?.logoUrl
    ? brandingTemplate.logoUrl
    : brandingTemplate?.usePropertyLogo
      ? propertyLogoUrl
      : null;
  const invoiceTitlePrefix =
    brandingTemplate?.invoiceTitlePrefix || "Invoice for";

  const items = invoice.items.map((item) => {
    const allocatedAmount = "allocations" in item
      ? (item.allocations ?? []).reduce(
          (sum, allocation) => sum + toNumber(allocation.amountAllocated),
          0
        )
      : 0;
    const amount = toNumber(item.amount);
    const recurringChargeLabel = getRecurringChargeLineLabel(item);
    const cosaAllocationBasisPresentation = getCosaAllocationBasisPresentation(
      item,
      amount
    );
    const quantityDisplay =
      item.itemType === "UTILITY_READING" && item.meterReading
        ? `${formatInvoiceQuantity(toNumber(item.quantity))} ${getUtilityUnitLabel(item.meterReading.meter.utilityType)}`
        : cosaAllocationBasisPresentation
          ? cosaAllocationBasisPresentation.quantityDisplay
        : item.quantity != null
          ? formatInvoiceQuantity(toNumber(item.quantity))
          : undefined;
    const typeLabel = item.itemType === "RECURRING_CHARGE" && recurringChargeLabel
      ? recurringChargeLabel
      : ITEM_TYPE_LABELS[item.itemType];
    const description = resolveInvoiceItemDescription(invoice, item);
    const quantity = cosaAllocationBasisPresentation
      ? cosaAllocationBasisPresentation.quantity
        : toNumber(item.quantity);
    const unitPrice =
      cosaAllocationBasisPresentation
        ? cosaAllocationBasisPresentation.unitPrice
        : toNumber(item.unitPrice);

    return {
      id: item.id,
      itemType: item.itemType,
      typeLabel,
      description,
      quantity,
      quantityDisplay,
      unitPrice,
      amount,
      allocatedAmount,
      remainingAmount: Math.max(0, amount - allocatedAmount),
    };
  });

  const utilityReadings = invoice.items.flatMap((item) => {
    if (!item.meterReading) {
      return [];
    }

    const utilityType = item.meterReading.meter.utilityType;
    const unitLabel = getUtilityUnitLabel(utilityType);

    return [
      {
        itemId: item.id,
        utilityType,
        utilityTypeLabel: UTILITY_TYPE_LABELS[utilityType],
        meterCode: item.meterReading.meter.meterCode,
        readingDateLabel: formatDate(item.meterReading.readingDate),
        previousReading: toNumber(item.meterReading.previousReading),
        currentReading: toNumber(item.meterReading.currentReading),
        consumption: toNumber(item.meterReading.consumption),
        ratePerUnit: toNumber(item.meterReading.ratePerUnit),
        totalAmount: toNumber(item.meterReading.totalAmount),
        consumptionLabel: `${toNumber(item.meterReading.consumption)} ${unitLabel}`,
        rateLabel: `₱${toNumber(item.meterReading.ratePerUnit).toLocaleString("en-PH")} / ${unitLabel}`,
      },
    ];
  });

  const cosaAllocations = invoice.items.flatMap((item) => {
    if (!item.cosaAllocation) {
      return [];
    }

    const sourceMeter =
      item.cosaAllocation.cosa.meterReading?.meter ?? item.cosaAllocation.cosa.meter ?? null;
    const sourceReading = item.cosaAllocation.cosa.meterReading ?? null;
    const sourceUtilityType = sourceMeter?.utilityType ?? null;

    return [
      {
        itemId: item.id,
        description: item.cosaAllocation.cosa.description,
        billingDateLabel: formatDate(item.cosaAllocation.cosa.billingDate),
        sourceTotalAmount: toNumber(item.cosaAllocation.cosa.totalAmount),
        allocatedAmount: toNumber(item.cosaAllocation.computedAmount),
        percentage: item.cosaAllocation.percentage == null
          ? null
          : toNumber(item.cosaAllocation.percentage),
        unitCount: item.cosaAllocation.unitCount ?? null,
        sourceUtilityTypeLabel: sourceMeter
          ? UTILITY_TYPE_LABELS[sourceMeter.utilityType]
          : null,
        sourceMeterCode: sourceMeter?.meterCode ?? null,
        sourceReadingDateLabel: sourceReading
          ? formatDate(sourceReading.readingDate)
          : null,
        sourcePreviousReadingLabel:
          sourceReading && sourceUtilityType
            ? formatUtilityQuantity(
                sourceUtilityType,
                toNumber(sourceReading.previousReading)
              )
            : null,
        sourceCurrentReadingLabel:
          sourceReading && sourceUtilityType
            ? formatUtilityQuantity(
                sourceUtilityType,
                toNumber(sourceReading.currentReading)
              )
            : null,
        sourceConsumptionLabel:
          sourceReading && sourceUtilityType
            ? formatUtilityQuantity(
                sourceUtilityType,
                toNumber(sourceReading.consumption)
              )
            : null,
        sourceRateLabel:
          sourceReading && sourceUtilityType
            ? `₱${toNumber(sourceReading.ratePerUnit).toLocaleString("en-PH")} / ${getUtilityUnitLabel(sourceUtilityType)}`
            : null,
      },
    ];
  });

  const payments = "payments" in invoice
    ? (invoice.payments ?? []).map((payment) => ({
        id: payment.id,
        amountPaid: toNumber(payment.amountPaid),
        paymentDateLabel: payment.paymentDate ? formatDate(payment.paymentDate) : "Pending",
        statusLabel: payment.status.replaceAll("_", " "),
        referenceNumber: payment.referenceNumber,
      }))
    : [];

  const collectedAmount = payments.reduce(
    (sum, payment) => sum + payment.amountPaid,
    0
  );

  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    title: `${invoiceTitlePrefix} ${formatBillingCycleMonthLabel(invoice.billingPeriodStart)}`,
    statusLabel: invoice.status.replaceAll("_", " "),
    originLabel: invoice.origin.replaceAll("_", " "),
    propertyCode: invoice.contract.property.propertyCode,
    propertyLogoUrl: resolvedLogoUrl,
    branding: {
      brandName: brandingTemplate?.brandName || "Propertia",
      brandSubtitle: brandingTemplate?.brandSubtitle || "Operations invoice",
      invoiceTitlePrefix,
      logoUrl: resolvedLogoUrl,
      titleScale: brandingTemplate?.titleScale || "STANDARD",
      logoScalePercent: brandingTemplate?.logoScalePercent || 100,
      brandNameSizePercent: brandingTemplate?.brandNameSizePercent || 100,
      brandSubtitleSizePercent: brandingTemplate?.brandSubtitleSizePercent || 100,
      tenantNameSizePercent: brandingTemplate?.tenantNameSizePercent || 100,
      titleSizePercent: brandingTemplate?.titleSizePercent || 100,
      brandNameWeight: brandingTemplate?.brandNameWeight || 600,
      tenantNameWeight: brandingTemplate?.tenantNameWeight || 700,
      titleWeight: brandingTemplate?.titleWeight || 700,
      accentColor: brandingTemplate?.accentColor || "#0284c7",
      labelColor: brandingTemplate?.labelColor || "#6f82a3",
      valueColor: brandingTemplate?.valueColor || "#081225",
      mutedColor: brandingTemplate?.mutedColor || "#53657f",
      panelBackground: brandingTemplate?.panelBackground || "#f8fbff",
    },
    tenantName: formatTenantName(invoice.tenant),
    propertyName: invoice.contract.property.name,
    dueDateLabel: formatDate(invoice.dueDate),
    issueDateLabel: formatDate(invoice.issueDate),
    billingPeriodLabel: `${formatDate(invoice.billingPeriodStart)} to ${formatDate(invoice.billingPeriodEnd)}`,
    billingAnchorLabel: formatDate(invoice.contract.paymentStartDate),
    notes: invoice.notes ?? null,
    totals: {
      subtotal: toNumber(invoice.subtotal),
      additionalCharges: toNumber(invoice.additionalCharges),
      discount: toNumber(invoice.discount),
      totalAmount: toNumber(invoice.totalAmount),
      balanceDue: toNumber(invoice.balanceDue),
      collectedAmount,
    },
    items,
    payments,
    breakdowns: {
      hasSecondPage: utilityReadings.length > 0 || cosaAllocations.length > 0,
      utilityReadings,
      cosaAllocations,
    },
  };
}

export function buildInvoicePreviewModel(): InvoicePresentationModel {
  return {
    invoiceId: "preview-invoice",
    invoiceNumber: "INV-260506-1FB2-PREV",
    title: "Invoice for May 2026",
    statusLabel: "Issued",
    originLabel: "Generated",
    propertyCode: "SLT-1F-B2",
    propertyLogoUrl: null,
    branding: {
      brandName: "Propertia",
      brandSubtitle: "Operations invoice",
      invoiceTitlePrefix: "Invoice for",
      logoUrl: null,
      titleScale: "STANDARD",
      logoScalePercent: 100,
      brandNameSizePercent: 100,
      brandSubtitleSizePercent: 100,
      tenantNameSizePercent: 100,
      titleSizePercent: 100,
      brandNameWeight: 600,
      tenantNameWeight: 700,
      titleWeight: 700,
      accentColor: "#0284c7",
      labelColor: "#6f82a3",
      valueColor: "#081225",
      mutedColor: "#53657f",
      panelBackground: "#f8fbff",
    },
    tenantName: "COCO MANGO",
    propertyName: "1F - B2",
    dueDateLabel: "Jun 7, 2026",
    issueDateLabel: "May 31, 2026",
    billingPeriodLabel: "May 1, 2026 to May 31, 2026",
    billingAnchorLabel: "Mar 1, 2026",
    notes:
      "Please settle on or before due date. Utilities reflect previous completed service cycle.",
    totals: {
      subtotal: 130000,
      additionalCharges: 18000,
      discount: 0,
      totalAmount: 148000,
      balanceDue: 98000,
      collectedAmount: 50000,
    },
    items: [
      {
        id: "item-rent",
        itemType: "RENT",
        typeLabel: "Rent",
        description: "Monthly rent · 1F - B2 · May 2026",
        quantity: 1,
        unitPrice: 130000,
        amount: 130000,
        allocatedAmount: 50000,
        remainingAmount: 80000,
      },
      {
        id: "item-charge",
        itemType: "RECURRING_CHARGE",
        typeLabel: "Internet",
        description: "Internet: May 1, 2026 to May 31, 2026",
        quantity: 1,
        unitPrice: 3000,
        amount: 3000,
        allocatedAmount: 0,
        remainingAmount: 3000,
      },
      {
        id: "item-utility",
        itemType: "UTILITY_READING",
        typeLabel: "Utility reading",
        description: "Water reading · WTR-01 · service Apr 1, 2026 to Apr 30, 2026",
        quantity: 40,
        unitPrice: 150,
        amount: 6000,
        allocatedAmount: 0,
        remainingAmount: 6000,
      },
      {
        id: "item-cosa",
        itemType: "COSA",
        typeLabel: "COSA",
        description: "Security guard share · May 2026",
        quantity: 1,
        unitPrice: 9000,
        amount: 9000,
        allocatedAmount: 0,
        remainingAmount: 9000,
      },
    ],
    payments: [
      {
        id: "payment-1",
        amountPaid: 50000,
        paymentDateLabel: "Jun 2, 2026",
        statusLabel: "Settled",
        referenceNumber: "GCASH-8891",
      },
    ],
    breakdowns: {
      hasSecondPage: false,
      utilityReadings: [],
      cosaAllocations: [],
    },
  };
}

function normalizeLegacyCosaDescription(description: string) {
  return description.split(" · ")[0]?.trim() || description;
}
