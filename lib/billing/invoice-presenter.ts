import { formatBillingCycleMonthLabel } from "@/lib/billing/cycles";
import { RECURRING_CHARGE_TYPE_LABELS } from "@/lib/form-options";
import { formatDate, toNumber } from "@/lib/format";

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
  items: Array<{
    id: string;
    itemType: keyof typeof ITEM_TYPE_LABELS;
    description: string;
    quantity: { toNumber(): number } | number;
    unitPrice: { toNumber(): number } | number;
    amount: { toNumber(): number } | number;
    contractRecurringCharge?: {
      label: string;
      chargeType: keyof typeof RECURRING_CHARGE_TYPE_LABELS;
    } | null;
    allocations?: Array<{
      id: string;
      amountAllocated: { toNumber(): number } | number;
    }>;
  }>;
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
  items: Array<{
    id: string;
    itemType: keyof typeof ITEM_TYPE_LABELS;
    description: string;
    quantity: { toNumber(): number } | number;
    unitPrice: { toNumber(): number } | number;
    amount: { toNumber(): number } | number;
    contractRecurringCharge?: {
      label: string;
      chargeType: keyof typeof RECURRING_CHARGE_TYPE_LABELS;
    } | null;
  }>;
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
    typeLabel: string;
    description: string;
    quantity: number;
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
};

export function formatTenantName(tenant: TenantShape) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
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
    const recurringChargeLabel = item.contractRecurringCharge?.chargeType
      ? RECURRING_CHARGE_TYPE_LABELS[item.contractRecurringCharge.chargeType]
      : item.contractRecurringCharge?.label;
    const typeLabel = item.itemType === "RECURRING_CHARGE" && recurringChargeLabel
      ? recurringChargeLabel
      : ITEM_TYPE_LABELS[item.itemType];
    const description = item.itemType === "RENT"
      ? `Rent payment: ${formatDate(invoice.billingPeriodStart)} to ${formatDate(invoice.billingPeriodEnd)}`
      : item.itemType === "RECURRING_CHARGE" && recurringChargeLabel
        ? `${recurringChargeLabel}: ${formatDate(invoice.billingPeriodStart)} to ${formatDate(invoice.billingPeriodEnd)}`
        : item.description;

    return {
      id: item.id,
      typeLabel,
      description,
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      amount,
      allocatedAmount,
      remainingAmount: Math.max(0, amount - allocatedAmount),
    };
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
  };
}
