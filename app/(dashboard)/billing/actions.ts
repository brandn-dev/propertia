"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import {
  cycleOverlapsRange,
  findNextCompletedBillingCycles,
  getBillingCycleKey,
} from "@/lib/billing/cycles";
import { invoiceGenerationSchema } from "@/lib/validations/invoice-generation";
import { paymentRecordingSchema } from "@/lib/validations/payment-recording";
import { recurringChargeSchema } from "@/lib/validations/recurring-charge";
import { toDateInputValue } from "@/lib/format";

export type InvoiceGenerationFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type RecurringChargeFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type RecordPaymentFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

type ParsedPaymentPayload = ReturnType<typeof getPaymentPayload>;

function getInvoiceGenerationPayload(formData: FormData) {
  return {
    contractId: String(formData.get("contractId") ?? ""),
    issueDate: String(formData.get("issueDate") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
  };
}

function getRecurringChargePayload(formData: FormData) {
  return {
    contractId: String(formData.get("contractId") ?? ""),
    chargeType: String(formData.get("chargeType") ?? ""),
    label: String(formData.get("label") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    effectiveStartDate: String(formData.get("effectiveStartDate") ?? ""),
    effectiveEndDate: String(formData.get("effectiveEndDate") ?? ""),
    isActive: formData.get("isActive") === "on",
  };
}

function parseAllocations(value: FormDataEntryValue | null) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return {
      allocations: [],
      error: null,
    };
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return {
        allocations: [],
        error: "Payment allocations are invalid.",
      };
    }

    return {
      allocations: parsed,
      error: null,
    };
  } catch {
    return {
      allocations: [],
      error: "Payment allocations are invalid.",
    };
  }
}

function getPaymentPayload(formData: FormData) {
  const allocationsResult = parseAllocations(formData.get("allocations"));

  return {
    paymentDate: String(formData.get("paymentDate") ?? ""),
    referenceNumber: String(formData.get("referenceNumber") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    allocations: allocationsResult.allocations,
    allocationsParseError: allocationsResult.error,
  };
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

function revalidateBillingViews() {
  [
    "/dashboard",
    "/billing",
    "/billing/charges",
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

function buildInvoiceNumber(issueDate: Date, propertyCode: string) {
  const year = issueDate.getFullYear();
  const month = String(issueDate.getMonth() + 1).padStart(2, "0");
  const day = String(issueDate.getDate()).padStart(2, "0");
  const suffix = randomUUID().slice(0, 8).toUpperCase();
  const cleanPropertyCode = propertyCode.replace(/[^A-Za-z0-9]/g, "").slice(0, 8);

  return `INV-${year}${month}${day}-${cleanPropertyCode || "PROP"}-${suffix}`;
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

function getInvoiceStatusFromBalance(balance: number, hasPayments: boolean) {
  if (balance <= 0) {
    return "PAID" as const;
  }

  return hasPayments ? ("PARTIALLY_PAID" as const) : ("ISSUED" as const);
}

export async function generateInvoicesAction(
  _previousState: InvoiceGenerationFormState,
  formData: FormData
): Promise<InvoiceGenerationFormState> {
  await requireRole("ADMIN");

  const validatedFields = invoiceGenerationSchema.safeParse(
    getInvoiceGenerationPayload(formData)
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted billing fields and try again.",
    };
  }

  const issueDate = endOfDay(new Date(validatedFields.data.issueDate));
  const dueDate = endOfDay(new Date(validatedFields.data.dueDate));

  const contracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      ...(validatedFields.data.contractId
        ? {
            id: validatedFields.data.contractId,
          }
        : {}),
      paymentStartDate: {
        lte: issueDate,
      },
      endDate: {
        gte: startOfDay(new Date(validatedFields.data.issueDate)),
      },
    },
    select: {
      id: true,
      tenantId: true,
      monthlyRent: true,
      paymentStartDate: true,
      endDate: true,
      property: {
        select: {
          id: true,
          propertyCode: true,
          name: true,
        },
      },
    },
  });

  if (validatedFields.data.contractId && contracts.length === 0) {
    return {
      errors: {
        contractId: ["Select an active contract that has started billing."],
      },
      message: "Contract selection is invalid for invoice generation.",
    };
  }

  if (contracts.length === 0) {
    return {
      message: "No active contracts are eligible for invoice generation on that issue date.",
    };
  }

  const [existingInvoices, recurringCharges, readings] = await Promise.all([
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
  ]);

  const existingPeriodsByContract = new Map<string, Set<string>>();

  for (const invoice of existingInvoices) {
    const key = getBillingCycleKey(
      invoice.billingPeriodStart,
      invoice.billingPeriodEnd
    );
    const periods = existingPeriodsByContract.get(invoice.contractId) ?? new Set<string>();
    periods.add(key);
    existingPeriodsByContract.set(invoice.contractId, periods);
  }

  const operations = [];

  for (const contract of contracts) {
    const missingCycles = findNextCompletedBillingCycles({
      anchorDate: contract.paymentStartDate,
      contractEndDate: contract.endDate,
      issueDate,
      existingPeriods: existingPeriodsByContract.get(contract.id) ?? new Set<string>(),
    });

    const contractCharges = recurringCharges.filter(
      (charge) => charge.contractId === contract.id
    );

    const contractReadings = readings.filter(
      (reading) =>
        reading.tenantId === contract.tenantId &&
        reading.meter.propertyId === contract.property.id
    );

    for (const cycle of missingCycles) {
      const cycleCharges = contractCharges.filter((charge) =>
        cycleOverlapsRange(cycle, charge.effectiveStartDate, charge.effectiveEndDate)
      );

      const cycleReadings = contractReadings.filter(
        (reading) =>
          reading.readingDate >= cycle.start && reading.readingDate <= cycle.end
      );

      const rentAmount = Number(contract.monthlyRent.toString());
      const recurringChargeAmount = cycleCharges.reduce(
        (sum, charge) => sum + Number(charge.amount.toString()),
        0
      );
      const utilityAmount = cycleReadings.reduce(
        (sum, reading) => sum + Number(reading.totalAmount.toString()),
        0
      );
      const additionalCharges = recurringChargeAmount + utilityAmount;
      const totalAmount = rentAmount + additionalCharges;

      operations.push(
        prisma.invoice.create({
          data: {
            invoiceNumber: buildInvoiceNumber(issueDate, contract.property.propertyCode),
            contractId: contract.id,
            tenantId: contract.tenantId,
            issueDate,
            dueDate,
            billingPeriodStart: cycle.start,
            billingPeriodEnd: cycle.end,
            subtotal: toMoney(rentAmount),
            additionalCharges: toMoney(additionalCharges),
            discount: toMoney(0),
            totalAmount: toMoney(totalAmount),
            balanceDue: toMoney(totalAmount),
            status: "ISSUED",
            items: {
              create: [
                {
                  itemType: "RENT",
                  description: `Monthly rent · ${contract.property.name} · ${toDateInputValue(cycle.start)} to ${toDateInputValue(cycle.end)}`,
                  quantity: toMoney(1),
                  unitPrice: toMoney(rentAmount),
                  amount: toMoney(rentAmount),
                },
                ...cycleCharges.map((charge) => ({
                  itemType: "RECURRING_CHARGE" as const,
                  description: `${charge.label} · ${toDateInputValue(cycle.start)} to ${toDateInputValue(cycle.end)}`,
                  quantity: toMoney(1),
                  unitPrice: toMoney(Number(charge.amount.toString())),
                  amount: toMoney(Number(charge.amount.toString())),
                  contractRecurringChargeId: charge.id,
                })),
                ...cycleReadings.map((reading) => ({
                  itemType: "UTILITY_READING" as const,
                  description: `${reading.meter.utilityType.replaceAll("_", " ")} reading · ${reading.meter.meterCode} · ${reading.readingDate.toISOString().slice(0, 10)}`,
                  quantity: toMoney(Number(reading.consumption.toString())),
                  unitPrice: toMoney(Number(reading.ratePerUnit.toString())),
                  amount: toMoney(Number(reading.totalAmount.toString())),
                  meterReadingId: reading.id,
                })),
              ],
            },
          },
        })
      );
    }
  }

  if (operations.length === 0) {
    return {
      message:
        "No completed uninvoiced billing cycles were found for the selected contract scope.",
    };
  }

  try {
    await prisma.$transaction(operations);
  } catch {
    return {
      message:
        "Invoices could not be generated. Check for duplicate billing cycles and try again.",
    };
  }

  revalidateBillingViews();
  redirect("/billing");
}

export async function createRecurringChargeAction(
  _previousState: RecurringChargeFormState,
  formData: FormData
): Promise<RecurringChargeFormState> {
  await requireRole("ADMIN");

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
  redirect("/billing/charges");
}

export async function updateRecurringChargeAction(
  chargeId: string,
  _previousState: RecurringChargeFormState,
  formData: FormData
): Promise<RecurringChargeFormState> {
  await requireRole("ADMIN");

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
  redirect("/billing/charges");
}

export async function recordPaymentAction(
  invoiceId: string,
  _previousState: RecordPaymentFormState,
  formData: FormData
): Promise<RecordPaymentFormState> {
  await requireRole("ADMIN");

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

  const itemMap = new Map(
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

  const normalizedAllocations = validatedFields.data.allocations
    .map((allocation) => ({
      ...allocation,
      amount: Number(allocation.amount),
    }))
    .filter((allocation) => allocation.amount > 0);

  const allocationErrors: string[] = [];

  for (const allocation of normalizedAllocations) {
    const invoiceItem = itemMap.get(allocation.invoiceItemId);

    if (!invoiceItem) {
      allocationErrors.push("One or more allocations do not belong to this invoice.");
      continue;
    }

    if (allocation.amount > invoiceItem.remainingAmount + 0.001) {
      allocationErrors.push("Allocation amounts cannot exceed the remaining balance of an item.");
    }
  }

  if (allocationErrors.length > 0) {
    return {
      errors: {
        allocations: allocationErrors,
      },
      message: "Payment allocations are invalid.",
    };
  }

  const totalAllocated = normalizedAllocations.reduce(
    (sum, allocation) => sum + allocation.amount,
    0
  );
  const totalRemaining = [...itemMap.values()].reduce(
    (sum, item) => sum + item.remainingAmount,
    0
  );
  const nextBalance = Math.max(0, totalRemaining - totalAllocated);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          contractId: invoice.contractId,
          amountPaid: toMoney(totalAllocated),
          dueDate: invoice.dueDate,
          paymentDate: new Date(validatedFields.data.paymentDate),
          status: "SETTLED",
          referenceNumber: validatedFields.data.referenceNumber ?? null,
          notes: validatedFields.data.notes ?? null,
          allocations: {
            create: normalizedAllocations.map((allocation) => ({
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
            invoice.payments.length > 0 || normalizedAllocations.length > 0
          ),
        },
      });
    });
  } catch {
    return {
      message: "Payment could not be recorded. Try again.",
    };
  }

  revalidateBillingViews();
  redirect(`/billing/${invoice.id}`);
}
