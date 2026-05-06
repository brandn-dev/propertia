"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import {
  getInvoiceTemplateLogoFileError,
  removeInvoiceTemplateLogoFile,
  storeInvoiceTemplateLogoFile,
} from "@/lib/properties/logo-storage";
import { prisma } from "@/lib/prisma";
import {
  filterCyclesWithoutInvoicedMonths,
  cycleOverlapsRange,
  findNextCompletedBillingCycles,
  formatBillingCycleLabel,
  getBillingCycleAtIndex,
  getBillingCycleKey,
  getInvoiceGenerationSelectionKey,
  getBillingMonthKey,
} from "@/lib/billing/cycles";
import { calculateAdjustedMonthlyRent } from "@/lib/billing/rent-adjustments";
import { getHistoricalBacklogCutoffDate } from "@/lib/billing/backlog";
import { generateInvoiceAccessCode } from "@/lib/billing/public-access";
import { calculateCosaAllocations } from "@/lib/billing/cosa";
import { buildInvoiceNumber } from "@/lib/billing/invoice-number";
import { getDescendantPropertyIds } from "@/lib/property-tree";
import { withToast } from "@/lib/toast";
import { invoiceBrandingTemplateSchema } from "@/lib/validations/invoice-branding-template";
import { cosaSchema } from "@/lib/validations/cosa";
import { cosaTemplateSchema } from "@/lib/validations/cosa-template";
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

type ParsedPaymentPayload = ReturnType<typeof getPaymentPayload>;
type ParsedCosaPayload = ReturnType<typeof getCosaPayload>;
type ParsedCosaTemplatePayload = ReturnType<typeof getCosaTemplatePayload>;

function getInvoiceGenerationPayload(formData: FormData) {
  return {
    tenantId: String(formData.get("tenantId") ?? ""),
    cycleSelections: formData
      .getAll("cycleSelections")
      .map((value) => String(value))
      .filter(Boolean),
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

function getCosaPayload(formData: FormData) {
  const allocationsResult = parseAllocations(formData.get("allocations"));

  return {
    propertyId: String(formData.get("propertyId") ?? ""),
    meterId: String(formData.get("meterId") ?? ""),
    meterReadingId: String(formData.get("meterReadingId") ?? ""),
    description: String(formData.get("description") ?? ""),
    totalAmount: String(formData.get("totalAmount") ?? ""),
    billingDate: String(formData.get("billingDate") ?? ""),
    allocationType: String(formData.get("allocationType") ?? ""),
    allocations: allocationsResult.allocations,
    allocationsParseError: allocationsResult.error,
  };
}

function getCosaTemplatePayload(formData: FormData) {
  const allocationsResult = parseAllocations(formData.get("allocations"));

  return {
    propertyId: String(formData.get("propertyId") ?? ""),
    meterId: String(formData.get("meterId") ?? ""),
    name: String(formData.get("name") ?? ""),
    allocationType: String(formData.get("allocationType") ?? ""),
    defaultAmount: String(formData.get("defaultAmount") ?? ""),
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

function getCosaParseError(payload: ParsedCosaPayload): CosaFormState | null {
  if (!payload.allocationsParseError) {
    return null;
  }

  return {
    errors: {
      allocations: [payload.allocationsParseError],
    },
    message: "COSA allocations could not be read. Try again.",
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
    message: "Template allocations could not be read. Try again.",
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

function deriveWholeMonths(amount: number, baseRent: number) {
  if (amount <= 0 || baseRent <= 0) {
    return 0;
  }

  const ratio = amount / baseRent;
  const rounded = Math.round(ratio);

  return Math.abs(ratio - rounded) < 0.01 ? rounded : 0;
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

function buildAdvanceApplicationCycleIndexes(params: {
  totalCycles: number;
  freeRentCycles: number;
  advanceRentMonths: number;
  application: "FIRST_BILLABLE_CYCLES" | "LAST_BILLABLE_CYCLES";
}) {
  const { totalCycles, freeRentCycles, advanceRentMonths, application } = params;
  // Free-rent cycles are always consumed first. Advance-rent credits can only
  // be assigned to the remaining billable cycles after that concession window.
  const billableCycleIndexes = Array.from({ length: totalCycles }, (_, index) => index)
    .filter((index) => index >= freeRentCycles);

  const selectedIndexes =
    application === "LAST_BILLABLE_CYCLES"
      ? billableCycleIndexes.slice(-advanceRentMonths)
      : billableCycleIndexes.slice(0, advanceRentMonths);

  return new Set(selectedIndexes);
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
  const cutoffDate = getHistoricalBacklogCutoffDate();

  const contracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      tenantId: validatedFields.data.tenantId,
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
      securityDepositMonths: true,
      advanceRentMonths: true,
      freeRentCycles: true,
      advanceRentApplication: true,
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

  const [existingInvoices, recurringCharges, readings, cosaAllocations] =
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

  const operations = [];
  const matchedSelectedCycleKeys = new Set<string>();

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
      application: contract.advanceRentApplication,
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
      const previousCycle =
        cycleIndex > 0
          ? getBillingCycleAtIndex(contract.paymentStartDate, cycleIndex - 1)
          : null;

      const cycleCharges = contractCharges.filter((charge) =>
        cycleOverlapsRange(cycle, charge.effectiveStartDate, charge.effectiveEndDate)
      );

      const cycleReadings = contractReadings.filter(
        (reading) =>
          previousCycle != null &&
          reading.readingDate >= previousCycle.start &&
          reading.readingDate <= previousCycle.end
      );
      const cycleCosaAllocations = contractCosaAllocations.filter(
        (allocation) =>
          allocation.cosa.billingDate >= cycle.start &&
          allocation.cosa.billingDate <= cycle.end
      );

      const rentAmount = calculateAdjustedMonthlyRent({
        baseMonthlyRent: contract.monthlyRent,
        cycleStart: cycle.start,
        adjustments: contract.rentAdjustments,
      });
      const cycleLabel = formatBillingCycleLabel(cycle);
      const utilityCoverageLabel = previousCycle
        ? `${toDateInputValue(previousCycle.start)} to ${toDateInputValue(previousCycle.end)}`
        : null;
      const recurringChargeAmount = cycleCharges.reduce(
        (sum, charge) => sum + Number(charge.amount.toString()),
        0
      );
      const utilityAmount = cycleReadings.reduce(
        (sum, reading) => sum + Number(reading.totalAmount.toString()),
        0
      );
      const cosaAmount = cycleCosaAllocations.reduce(
        (sum, allocation) => sum + Number(allocation.computedAmount.toString()),
        0
      );
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
      const additionalCharges =
        recurringChargeAmount +
        utilityAmount +
        cosaAmount +
        oneTimeSecurityDepositCharge +
        freeRentConcessionAmount -
        advanceRentCreditAmount;
      const totalAmount = rentAmount + additionalCharges;
      const balanceDue = Math.max(0, totalAmount);
      const status = getInvoiceStatusFromBalance(balanceDue, false);

      operations.push(
        prisma.invoice.create({
          data: {
            invoiceNumber: buildInvoiceNumber(issueDate, contract.property.propertyCode),
            contractId: contract.id,
            tenantId: contract.tenantId,
            publicAccessCode: generateInvoiceAccessCode(),
            issueDate,
            dueDate,
            billingPeriodStart: cycle.start,
            billingPeriodEnd: cycle.end,
            subtotal: toMoney(rentAmount),
            additionalCharges: toMoney(additionalCharges),
            discount: toMoney(0),
            totalAmount: toMoney(totalAmount),
            balanceDue: toMoney(balanceDue),
            status,
            items: {
              create: [
                {
                  itemType: "RENT",
                  description: `Rent for ${cycleLabel} · ${contract.property.name} · ${toDateInputValue(cycle.start)} to ${toDateInputValue(cycle.end)}`,
                  quantity: toMoney(1),
                  unitPrice: toMoney(rentAmount),
                  amount: toMoney(rentAmount),
                },
                ...(oneTimeSecurityDepositCharge > 0
                  ? [
                      {
                        itemType: "ADJUSTMENT" as const,
                        description: `Security deposit · ${securityDepositMonths} month(s)`,
                        quantity: toMoney(1),
                        unitPrice: toMoney(oneTimeSecurityDepositCharge),
                        amount: toMoney(oneTimeSecurityDepositCharge),
                      },
                    ]
                  : []),
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
                  description: `${reading.meter.utilityType.replaceAll("_", " ")} reading · ${reading.meter.meterCode} · ${reading.readingDate.toISOString().slice(0, 10)}${
                    utilityCoverageLabel ? ` · service ${utilityCoverageLabel}` : ""
                  }`,
                  quantity: toMoney(Number(reading.consumption.toString())),
                  unitPrice: toMoney(Number(reading.ratePerUnit.toString())),
                  amount: toMoney(Number(reading.totalAmount.toString())),
                  meterReadingId: reading.id,
                })),
                ...cycleCosaAllocations.map((allocation) => ({
                  itemType: "COSA" as const,
                  description: `${allocation.cosa.description} · ${allocation.cosa.billingDate.toISOString().slice(0, 10)}${
                    allocation.cosa.meter
                      ? ` · ${allocation.cosa.meter.utilityType.replaceAll("_", " ")} ${allocation.cosa.meter.meterCode}`
                      : ""
                  }`,
                  quantity: toMoney(1),
                  unitPrice: toMoney(Number(allocation.computedAmount.toString())),
                  amount: toMoney(Number(allocation.computedAmount.toString())),
                  cosaAllocationId: allocation.id,
                })),
                ...(freeRentConcessionAmount > 0
                  ? [
                      {
                        itemType: "ADJUSTMENT" as const,
                        description: `Free rent concession · ${cycleLabel}`,
                        quantity: toMoney(1),
                        unitPrice: toMoney(-freeRentConcessionAmount),
                        amount: toMoney(-freeRentConcessionAmount),
                      },
                    ]
                  : []),
                ...(advanceRentCreditAmount > 0
                  ? [
                      {
                        itemType: "ADJUSTMENT" as const,
                        description: `Advance rent applied · ${cycleLabel}`,
                        quantity: toMoney(1),
                        unitPrice: toMoney(-advanceRentCreditAmount),
                        amount: toMoney(-advanceRentCreditAmount),
                      },
                    ]
                  : []),
              ],
            },
          },
        })
      );
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

  if (operations.length === 0) {
    return {
      message:
        "No selected billing months were eligible for invoice generation.",
    };
  }

  try {
    await prisma.$transaction(operations);
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
      description: `Generated ${operations.length} invoice cycle(s).`,
    })
  );
}

export async function createCosaAction(
  _previousState: CosaFormState,
  formData: FormData
): Promise<CosaFormState> {
  await requireRole("ADMIN");

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

  const contractIds = validatedFields.data.allocations.map(
    (allocation) => allocation.contractId
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
        const contract = contractMap.get(allocation.contractId);

        return {
          contractId: allocation.contractId,
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
        billingDate: endOfDay(new Date(validatedFields.data.billingDate)),
        allocationType: validatedFields.data.allocationType,
        allocations: {
          create: calculatedAllocations.map((allocation) => ({
            contractId: allocation.contractId,
            percentage: toMoney(allocation.percentage),
            unitCount:
              validatedFields.data.allocations.find(
                (entry) => entry.contractId === allocation.contractId
              )?.unitCount
                ? Number(
                    validatedFields.data.allocations.find(
                      (entry) => entry.contractId === allocation.contractId
                    )?.unitCount
                  )
                : null,
            computedAmount: toMoney(allocation.computedAmount),
          })),
        },
      },
    });
  } catch {
    return {
      message: "COSA record could not be saved. Try again.",
    };
  }

  revalidateBillingViews();
  redirect("/billing/cosa");
}

export async function updateCosaAction(
  cosaId: string,
  _previousState: CosaFormState,
  formData: FormData
): Promise<CosaFormState> {
  await requireRole("ADMIN");

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

  const contractIds = validatedFields.data.allocations.map(
    (allocation) => allocation.contractId
  );
  const selectionValidation = await validateCosaSelections({
    propertyId: validatedFields.data.propertyId,
    meterId: validatedFields.data.meterId,
    meterReadingId: validatedFields.data.meterReadingId,
    contractIds,
    editableContractIds: existingCosa.allocations.map(
      (allocation) => allocation.contractId
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
        const contract = contractMap.get(allocation.contractId);

        return {
          contractId: allocation.contractId,
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
        billingDate: endOfDay(new Date(validatedFields.data.billingDate)),
        allocationType: validatedFields.data.allocationType,
        allocations: {
          deleteMany: {},
          create: calculatedAllocations.map((allocation) => ({
            contractId: allocation.contractId,
            percentage: toMoney(allocation.percentage),
            unitCount:
              validatedFields.data.allocations.find(
                (entry) => entry.contractId === allocation.contractId
              )?.unitCount
                ? Number(
                    validatedFields.data.allocations.find(
                      (entry) => entry.contractId === allocation.contractId
                    )?.unitCount
                  )
                : null,
            computedAmount: toMoney(allocation.computedAmount),
          })),
        },
      },
    });
  } catch {
    return {
      message: "COSA record could not be updated. Try again.",
    };
  }

  revalidateBillingViews();
  redirect("/billing/cosa");
}

export async function createCosaTemplateAction(
  _previousState: CosaTemplateFormState,
  formData: FormData
): Promise<CosaTemplateFormState> {
  await requireRole("ADMIN");

  const payload = getCosaTemplatePayload(formData);
  const parseError = getCosaTemplateParseError(payload);

  if (parseError) {
    return parseError;
  }

  const validatedFields = cosaTemplateSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted COSA template fields and try again.",
    };
  }

  const contractIds = validatedFields.data.allocations.map(
    (allocation) => allocation.contractId
  );
  const selectionValidation = await validateCosaSelections({
    propertyId: validatedFields.data.propertyId,
    meterId: validatedFields.data.meterId,
    contractIds,
  });

  if (selectionValidation.errors) {
    return {
      errors: selectionValidation.errors,
      message: "Template selections are invalid.",
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
        isActive: validatedFields.data.isActive,
        allocations: {
          create: validatedFields.data.allocations.map((allocation) => ({
            contractId: allocation.contractId,
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
      message: "COSA template could not be saved. Try again.",
    };
  }

  revalidateBillingViews();
  redirect("/billing/cosa/templates");
}

export async function updateCosaTemplateAction(
  templateId: string,
  _previousState: CosaTemplateFormState,
  formData: FormData
): Promise<CosaTemplateFormState> {
  await requireRole("ADMIN");

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
      message: "Fix the highlighted COSA template fields and try again.",
    };
  }

  const contractIds = validatedFields.data.allocations.map(
    (allocation) => allocation.contractId
  );
  const selectionValidation = await validateCosaSelections({
    propertyId: validatedFields.data.propertyId,
    meterId: validatedFields.data.meterId,
    contractIds,
    editableContractIds: existingTemplate.allocations.map(
      (allocation) => allocation.contractId
    ),
  });

  if (selectionValidation.errors) {
    return {
      errors: selectionValidation.errors,
      message: "Template selections are invalid.",
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
        isActive: validatedFields.data.isActive,
        allocations: {
          deleteMany: {},
          create: validatedFields.data.allocations.map((allocation) => ({
            contractId: allocation.contractId,
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
      message: "COSA template could not be updated. Try again.",
    };
  }

  revalidateBillingViews();
  redirect("/billing/cosa/templates");
}

export async function createInvoiceBrandingTemplateAction(
  _previousState: InvoiceBrandingTemplateFormState,
  formData: FormData
): Promise<InvoiceBrandingTemplateFormState> {
  await requireRole("ADMIN");

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
  redirect("/billing/invoice-templates");
}

export async function updateInvoiceBrandingTemplateAction(
  templateId: string,
  _previousState: InvoiceBrandingTemplateFormState,
  formData: FormData
): Promise<InvoiceBrandingTemplateFormState> {
  await requireRole("ADMIN");

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
  redirect("/billing/invoice-templates");
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
  redirect(
    withToast(`/billing/${invoice.id}`, {
      intent: "success",
      title: "Payment recorded",
      description: `Recorded payment for ${invoice.invoiceNumber}.`,
    })
  );
}
