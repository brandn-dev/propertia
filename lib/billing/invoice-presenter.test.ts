import assert from "node:assert/strict";
import test from "node:test";
import {
  buildInvoicePresentationModel,
  resolveInvoiceItemDescription,
} from "@/lib/billing/invoice-presenter";

const billingPeriodStart = new Date("2026-06-01T00:00:00.000Z");
const billingPeriodEnd = new Date("2026-06-30T00:00:00.000Z");

function createInvoiceContext(overrides: Partial<Parameters<typeof resolveInvoiceItemDescription>[0]> = {}) {
  return {
    origin: "GENERATED",
    billingPeriodStart,
    billingPeriodEnd,
    tenant: {
      firstName: null,
      lastName: null,
      businessName: "Blue Haven",
      invoiceDescriptionDateDisplayDefault: "SHOW" as const,
    },
    ...overrides,
  };
}

test("tenant show mode keeps generated rent coverage dates", () => {
  const description = resolveInvoiceItemDescription(createInvoiceContext(), {
    id: "rent-1",
    itemType: "RENT",
    description: "Rent for June 2026 · Unit A · 2026-06-01 to 2026-06-30",
  });

  assert.equal(description, "Coverage: Jun 1, 2026 to Jun 30, 2026");
});

test("tenant hide mode removes generated rent date suffix", () => {
  const description = resolveInvoiceItemDescription(
    createInvoiceContext({
      tenant: {
        firstName: null,
        lastName: null,
        businessName: "Blue Haven",
        invoiceDescriptionDateDisplayDefault: "HIDE",
      },
    }),
    {
      id: "rent-1",
      itemType: "RENT",
      description: "Rent for June 2026 · Unit A · 2026-06-01 to 2026-06-30",
    }
  );

  assert.equal(description, "Rent for June 2026 · Unit A");
});

test("recurring charge show override beats tenant hide", () => {
  const description = resolveInvoiceItemDescription(
    createInvoiceContext({
      tenant: {
        firstName: null,
        lastName: null,
        businessName: "Blue Haven",
        invoiceDescriptionDateDisplayDefault: "HIDE",
      },
    }),
    {
      id: "charge-1",
      itemType: "RECURRING_CHARGE",
      description: "Fiber internet · 2026-06-01 to 2026-06-30",
      contractRecurringCharge: {
        label: "Fiber internet",
        chargeType: "INTERNET",
        descriptionDateDisplayOverride: "SHOW",
      },
    }
  );

  assert.equal(description, "Internet: Jun 1, 2026 to Jun 30, 2026");
});

test("recurring charge hide override beats tenant show", () => {
  const description = resolveInvoiceItemDescription(createInvoiceContext(), {
    id: "charge-1",
    itemType: "RECURRING_CHARGE",
    description: "Fiber internet · 2026-06-01 to 2026-06-30",
    contractRecurringCharge: {
      label: "Fiber internet",
      chargeType: "INTERNET",
      descriptionDateDisplayOverride: "HIDE",
    },
  });

  assert.equal(description, "Fiber internet");
});

test("recurring charge without linked charge falls back to stored description parsing", () => {
  const description = resolveInvoiceItemDescription(
    createInvoiceContext({
      tenant: {
        firstName: null,
        lastName: null,
        businessName: "Blue Haven",
        invoiceDescriptionDateDisplayDefault: "HIDE",
      },
    }),
    {
      id: "charge-legacy",
      itemType: "RECURRING_CHARGE",
      description: "Association dues · 2026-06-01 to 2026-06-30",
    }
  );

  assert.equal(description, "Association dues");
});

test("manual backlog rent descriptions stay unchanged", () => {
  const description = resolveInvoiceItemDescription(
    createInvoiceContext({
      origin: "BACKLOG",
      tenant: {
        firstName: null,
        lastName: null,
        businessName: "Blue Haven",
        invoiceDescriptionDateDisplayDefault: "HIDE",
      },
    }),
    {
      id: "rent-backlog",
      itemType: "RENT",
      description: "Manual rent for June 2026",
    }
  );

  assert.equal(description, "Manual rent for June 2026");
});

test("invoice item custom mode wins over generated defaults", () => {
  const description = resolveInvoiceItemDescription(createInvoiceContext(), {
    id: "rent-custom",
    itemType: "RENT",
    description: "Rent for June 2026 · Unit A · 2026-06-01 to 2026-06-30",
    descriptionMode: "CUSTOM",
    customDescription: "Monthly rent for employee housing",
  });

  assert.equal(description, "Monthly rent for employee housing");
});

test("invoice item hide mode wins over tenant show for recurring charge", () => {
  const description = resolveInvoiceItemDescription(createInvoiceContext(), {
    id: "charge-hide",
    itemType: "RECURRING_CHARGE",
    description: "Internet · 2026-06-01 to 2026-06-30",
    descriptionMode: "HIDE",
    contractRecurringCharge: {
      label: "Internet",
      chargeType: "INTERNET",
      descriptionDateDisplayOverride: null,
    },
  });

  assert.equal(description, "Internet");
});

test("per-unit cosa rows show unit counts and derived unit price", () => {
  const invoice = {
    id: "invoice-cosa-1",
    invoiceNumber: "INV-TEST-COSA",
    issueDate: new Date("2026-06-01T00:00:00.000Z"),
    dueDate: new Date("2026-06-05T00:00:00.000Z"),
    billingPeriodStart,
    billingPeriodEnd,
    subtotal: 2295.11,
    additionalCharges: 0,
    discount: 0,
    totalAmount: 2295.11,
    balanceDue: 2295.11,
    origin: "GENERATED",
    status: "ISSUED",
    notes: null,
    contract: {
      paymentStartDate: new Date("2026-06-01T00:00:00.000Z"),
      property: {
        name: "The Spa",
        propertyCode: "SPA",
        logoUrl: null,
        invoiceBrandingTemplate: null,
      },
    },
    tenant: {
      firstName: null,
      lastName: null,
      businessName: "The Spa",
      invoiceDescriptionDateDisplayDefault: "SHOW" as const,
    },
    items: [
      {
        id: "item-cosa-1",
        itemType: "COSA" as const,
        description: "Generator Fuel",
        descriptionMode: "AUTO" as const,
        customDescription: null,
        quantity: 1,
        unitPrice: 2295.11,
        amount: 2295.11,
        cosaAllocation: {
          id: "allocation-1",
          percentage: 22.9511,
          unitCount: 2,
          computedAmount: 2295.11,
          cosa: {
            id: "cosa-1",
            description: "Generator Fuel",
            billingDate: new Date("2026-06-01T00:00:00.000Z"),
            totalAmount: 10000,
            allocationType: "PER_UNIT" as const,
            meter: null,
            meterReading: null,
          },
        },
        allocations: [],
      },
    ],
    payments: [],
  } satisfies Parameters<typeof buildInvoicePresentationModel>[0];

  const model = buildInvoicePresentationModel(invoice);

  assert.equal(model.items[0]?.quantity, 2);
  assert.equal(model.items[0]?.quantityDisplay, "2 units");
  assert.equal(model.items[0]?.unitPrice, 1147.56);
  assert.equal(model.items[0]?.description, "Generator Fuel");
});

test("percentage cosa rows show saved percentage basis", () => {
  const invoice = {
    id: "invoice-cosa-2",
    invoiceNumber: "INV-TEST-COSA-METER",
    issueDate: new Date("2026-06-01T00:00:00.000Z"),
    dueDate: new Date("2026-06-05T00:00:00.000Z"),
    billingPeriodStart,
    billingPeriodEnd,
    subtotal: 68.6,
    additionalCharges: 0,
    discount: 0,
    totalAmount: 68.6,
    balanceDue: 68.6,
    origin: "GENERATED",
    status: "ISSUED",
    notes: null,
    contract: {
      paymentStartDate: new Date("2026-06-01T00:00:00.000Z"),
      property: {
        name: "Coco Nails",
        propertyCode: "COCO",
        logoUrl: null,
        invoiceBrandingTemplate: null,
      },
    },
    tenant: {
      firstName: null,
      lastName: null,
      businessName: "Coco Nails",
      invoiceDescriptionDateDisplayDefault: "SHOW" as const,
    },
    items: [
      {
        id: "item-cosa-water-1",
        itemType: "COSA" as const,
        description: "Common Water",
        descriptionMode: "AUTO" as const,
        customDescription: null,
        quantity: 1,
        unitPrice: 68.6,
        amount: 68.6,
        cosaAllocation: {
          id: "allocation-water-1",
          percentage: 35,
          unitCount: null,
          computedAmount: 68.6,
          cosa: {
            id: "cosa-water-1",
            description: "Common Water",
            billingDate: new Date("2026-06-01T00:00:00.000Z"),
            totalAmount: 196,
            allocationType: "PERCENTAGE" as const,
            meter: {
              id: "meter-water-1",
              meterCode: "SH-WTR-1",
              utilityType: "WATER",
            },
            meterReading: {
              id: "reading-water-1",
              readingDate: new Date("2026-05-31T00:00:00.000Z"),
              previousReading: 100,
              currentReading: 102,
              ratePerUnit: 98,
              consumption: 2,
              totalAmount: 196,
              meter: {
                id: "meter-water-1",
                meterCode: "SH-WTR-1",
                utilityType: "WATER",
              },
            },
          },
        },
        allocations: [],
      },
    ],
    payments: [],
  } satisfies Parameters<typeof buildInvoicePresentationModel>[0];

  const model = buildInvoicePresentationModel(invoice);

  assert.equal(model.items[0]?.quantity, 35);
  assert.equal(model.items[0]?.quantityDisplay, "35%");
  assert.equal(model.items[0]?.unitPrice, 1.96);
  assert.equal(model.items[0]?.description, "Common Water");
});
