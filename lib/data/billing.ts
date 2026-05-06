import "server-only";

import type { Prisma } from "@prisma/client";
import {
  filterCyclesWithoutInvoicedMonths,
  findNextCompletedBillingCycles,
  formatBillingCycleLabel,
  getBillingCycleKey,
  getBillingMonthKey,
} from "@/lib/billing/cycles";
import { getHistoricalBacklogCutoffDate, getHistoricalBacklogLatestDate } from "@/lib/billing/backlog";
import { prisma, withPrismaRetry } from "@/lib/prisma";

const recurringChargeOverviewSelect = {
  id: true,
  chargeType: true,
  label: true,
  amount: true,
  effectiveStartDate: true,
  effectiveEndDate: true,
  isActive: true,
  contract: {
    select: {
      id: true,
      status: true,
      paymentStartDate: true,
      property: {
        select: {
          name: true,
          propertyCode: true,
        },
      },
      tenant: {
        select: {
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
    },
  },
  _count: {
    select: {
      invoiceItems: true,
    },
  },
} satisfies Prisma.ContractRecurringChargeSelect;

export type RecurringChargeOverviewItem =
  Prisma.ContractRecurringChargeGetPayload<{
    select: typeof recurringChargeOverviewSelect;
  }>;

export async function getInvoiceGenerationContractOptions() {
  return prisma.contract.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: [{ paymentStartDate: "asc" }],
    select: {
      id: true,
      tenantId: true,
      endDate: true,
      paymentStartDate: true,
      property: {
        select: {
          name: true,
          propertyCode: true,
        },
      },
      tenant: {
        select: {
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      _count: {
        select: {
          recurringCharges: true,
          rentAdjustments: true,
        },
      },
      invoices: {
        select: {
          billingPeriodStart: true,
          billingPeriodEnd: true,
        },
      },
    },
  });
}

export async function getInvoiceBrandingTemplatesOverview() {
  return withPrismaRetry(() =>
    prisma.invoiceBrandingTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        brandName: true,
        brandSubtitle: true,
        invoiceTitlePrefix: true,
        logoUrl: true,
        usePropertyLogo: true,
        titleScale: true,
        logoScalePercent: true,
        brandNameSizePercent: true,
        brandSubtitleSizePercent: true,
        tenantNameSizePercent: true,
        titleSizePercent: true,
        brandNameWeight: true,
        tenantNameWeight: true,
        titleWeight: true,
        accentColor: true,
        labelColor: true,
        valueColor: true,
        mutedColor: true,
        panelBackground: true,
        isDefault: true,
        properties: {
          orderBy: [{ name: "asc" }],
          select: {
            id: true,
            name: true,
            propertyCode: true,
          },
        },
        _count: {
          select: {
            properties: true,
          },
        },
      },
    })
  );
}

export async function getInvoiceBrandingTemplateForEdit(templateId: string) {
  return withPrismaRetry(() =>
    prisma.invoiceBrandingTemplate.findUnique({
      where: { id: templateId },
      select: {
        id: true,
        name: true,
        brandName: true,
        brandSubtitle: true,
        invoiceTitlePrefix: true,
        logoUrl: true,
        logoStorageKey: true,
        usePropertyLogo: true,
        titleScale: true,
        logoScalePercent: true,
        brandNameSizePercent: true,
        brandSubtitleSizePercent: true,
        tenantNameSizePercent: true,
        titleSizePercent: true,
        brandNameWeight: true,
        tenantNameWeight: true,
        titleWeight: true,
        accentColor: true,
        labelColor: true,
        valueColor: true,
        mutedColor: true,
        panelBackground: true,
        isDefault: true,
        properties: {
          orderBy: [{ name: "asc" }],
          select: {
            id: true,
            name: true,
            propertyCode: true,
          },
        },
        _count: {
          select: {
            properties: true,
          },
        },
      },
    })
  );
}

export async function getHistoricalBacklogContractOptions() {
  const cutoffDate = getHistoricalBacklogCutoffDate();
  const latestBacklogDate = getHistoricalBacklogLatestDate();
  const contracts = await prisma.contract.findMany({
    where: {
      paymentStartDate: {
        lt: cutoffDate,
      },
    },
    orderBy: [{ paymentStartDate: "asc" }],
    select: {
      id: true,
      tenantId: true,
      status: true,
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
      tenant: {
        select: {
          firstName: true,
          lastName: true,
          businessName: true,
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

  const meterScopeFilters = contracts.map((contract) => ({
    propertyId: contract.property.id,
    tenantId: contract.tenantId,
    isShared: false,
  }));

  const meters = meterScopeFilters.length
    ? await prisma.utilityMeter.findMany({
        where: {
          OR: meterScopeFilters,
        },
        orderBy: [{ utilityType: "asc" }, { meterCode: "asc" }],
        select: {
          id: true,
          propertyId: true,
          tenantId: true,
          meterCode: true,
          utilityType: true,
        },
      })
    : [];

  const metersByContractScope = new Map<string, typeof meters>();

  for (const contract of contracts) {
    const scopeKey = `${contract.property.id}:${contract.tenantId}`;
    metersByContractScope.set(
      scopeKey,
      meters.filter(
        (meter) =>
          meter.propertyId === contract.property.id &&
          meter.tenantId === contract.tenantId
      )
    );
  }

  return contracts
    .map((contract) => {
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
      const pendingBacklogCycles = filterCyclesWithoutInvoicedMonths(
        findNextCompletedBillingCycles({
          anchorDate: contract.paymentStartDate,
          contractEndDate: contract.endDate,
          issueDate: latestBacklogDate,
          existingPeriods,
        }),
        existingMonthKeys
      ).filter((cycle) => cycle.start <= cutoffDate);

      return {
        id: contract.id,
        tenantId: contract.tenantId,
        status: contract.status,
        paymentStartDate: contract.paymentStartDate.toISOString(),
        endDate: contract.endDate.toISOString(),
        monthlyRent: contract.monthlyRent.toString(),
        freeRentCycles: contract.freeRentCycles,
        advanceRentMonths: contract.advanceRentMonths,
        advanceRentApplication: contract.advanceRentApplication,
        advanceRent: contract.advanceRent.toString(),
        property: contract.property,
        tenant: contract.tenant,
        meters:
          metersByContractScope.get(`${contract.property.id}:${contract.tenantId}`) ?? [],
        pendingBacklogCycles: pendingBacklogCycles.map((cycle) => ({
          key: getBillingCycleKey(cycle.start, cycle.end),
          start: cycle.start.toISOString(),
          end: cycle.end.toISOString(),
          label: formatBillingCycleLabel(cycle),
        })),
      };
    })
    .filter((contract) => contract.pendingBacklogCycles.length > 0);
}

export async function getRecurringChargeContractOptions(includeContractId?: string) {
  return prisma.contract.findMany({
    where: includeContractId
      ? {
          OR: [
            {
              status: {
                in: ["DRAFT", "ACTIVE"],
              },
            },
            {
              id: includeContractId,
            },
          ],
        }
      : {
          status: {
            in: ["DRAFT", "ACTIVE"],
          },
        },
    orderBy: [{ paymentStartDate: "asc" }],
    select: {
      id: true,
      status: true,
      paymentStartDate: true,
      property: {
        select: {
          name: true,
          propertyCode: true,
        },
      },
      tenant: {
        select: {
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
    },
  });
}

export async function getRecurringChargesOverview(): Promise<
  RecurringChargeOverviewItem[]
> {
  return prisma.contractRecurringCharge.findMany({
    orderBy: [{ isActive: "desc" }, { effectiveStartDate: "asc" }],
    select: recurringChargeOverviewSelect,
  });
}

export async function getRecurringChargeForEdit(chargeId: string) {
  return prisma.contractRecurringCharge.findUnique({
    where: { id: chargeId },
    select: {
      id: true,
      contractId: true,
      chargeType: true,
      label: true,
      amount: true,
      effectiveStartDate: true,
      effectiveEndDate: true,
      isActive: true,
      contract: {
        select: {
          status: true,
          paymentStartDate: true,
          property: {
            select: {
              name: true,
              propertyCode: true,
            },
          },
          tenant: {
            select: {
              firstName: true,
              lastName: true,
              businessName: true,
            },
          },
        },
      },
      _count: {
        select: {
          invoiceItems: true,
        },
      },
    },
  });
}

export async function getCosaPropertyOptions(includePropertyId?: string) {
  return prisma.property.findMany({
    where: includePropertyId
      ? {
          OR: [
            {
              status: {
                not: "ARCHIVED",
              },
            },
            {
              id: includePropertyId,
            },
          ],
        }
      : {
          status: {
            not: "ARCHIVED",
          },
        },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      propertyCode: true,
      parentPropertyId: true,
      status: true,
    },
  });
}

export async function getCosaSharedMeterOptions(includeMeterId?: string) {
  const meters = await prisma.utilityMeter.findMany({
    where: includeMeterId
      ? {
          OR: [
            {
              isShared: true,
            },
            {
              id: includeMeterId,
            },
          ],
        }
      : {
          isShared: true,
        },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      meterCode: true,
      utilityType: true,
      propertyId: true,
      property: {
        select: {
          name: true,
          propertyCode: true,
        },
      },
      readings: {
        orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          readingDate: true,
          previousReading: true,
          currentReading: true,
          consumption: true,
          ratePerUnit: true,
          totalAmount: true,
          cosa: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });

  return meters.map((meter) => ({
    ...meter,
    readings: meter.readings.map((reading) => ({
      id: reading.id,
      readingDate: reading.readingDate.toISOString(),
      previousReading: reading.previousReading.toString(),
      currentReading: reading.currentReading.toString(),
      consumption: reading.consumption.toString(),
      ratePerUnit: reading.ratePerUnit.toString(),
      totalAmount: reading.totalAmount.toString(),
      cosaId: reading.cosa?.id ?? null,
    })),
  }));
}

export async function getCosaContractOptions(includeContractIds: string[] = []) {
  return prisma.contract.findMany({
    where: includeContractIds.length > 0
      ? {
          OR: [
            {
              status: "ACTIVE",
            },
            {
              id: {
                in: includeContractIds,
              },
            },
          ],
        }
      : {
          status: "ACTIVE",
        },
    orderBy: [{ paymentStartDate: "asc" }],
    select: {
      id: true,
      status: true,
      paymentStartDate: true,
      property: {
        select: {
          id: true,
          parentPropertyId: true,
          name: true,
          propertyCode: true,
          size: true,
        },
      },
      tenant: {
        select: {
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
    },
  });
}

export async function getCosasOverview() {
  return prisma.cOSA.findMany({
    orderBy: [{ billingDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      description: true,
      allocationType: true,
      totalAmount: true,
      billingDate: true,
      property: {
        select: {
          name: true,
          propertyCode: true,
        },
      },
      meter: {
        select: {
          id: true,
          meterCode: true,
          utilityType: true,
        },
      },
      meterReading: {
        select: {
          id: true,
          readingDate: true,
          totalAmount: true,
        },
      },
      allocations: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          percentage: true,
          unitCount: true,
          computedAmount: true,
          invoiceItem: {
            select: {
              id: true,
            },
          },
          contract: {
            select: {
              id: true,
              status: true,
              property: {
                select: {
                  name: true,
                  propertyCode: true,
                },
              },
              tenant: {
                select: {
                  firstName: true,
                  lastName: true,
                  businessName: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getCosaForEdit(cosaId: string) {
  return prisma.cOSA.findUnique({
    where: { id: cosaId },
    select: {
      id: true,
      propertyId: true,
      meterId: true,
      meterReadingId: true,
      description: true,
      totalAmount: true,
      billingDate: true,
      allocationType: true,
      property: {
        select: {
          name: true,
          propertyCode: true,
        },
      },
      meter: {
        select: {
          id: true,
          meterCode: true,
          utilityType: true,
        },
      },
      meterReading: {
        select: {
          id: true,
          readingDate: true,
          totalAmount: true,
        },
      },
      allocations: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          percentage: true,
          unitCount: true,
          computedAmount: true,
          invoiceItem: {
            select: {
              id: true,
            },
          },
          contract: {
            select: {
              id: true,
              status: true,
              paymentStartDate: true,
              property: {
                select: {
                  id: true,
                  parentPropertyId: true,
                  name: true,
                  propertyCode: true,
                  size: true,
                },
              },
              tenant: {
                select: {
                  firstName: true,
                  lastName: true,
                  businessName: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getCosaTemplatesOverview() {
  return prisma.cosaTemplate.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      allocationType: true,
      defaultAmount: true,
      isActive: true,
      property: {
        select: {
          name: true,
          propertyCode: true,
        },
      },
      meter: {
        select: {
          id: true,
          meterCode: true,
          utilityType: true,
        },
      },
      allocations: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          percentage: true,
          unitCount: true,
          amount: true,
          contract: {
            select: {
              id: true,
              status: true,
              property: {
                select: {
                  name: true,
                  propertyCode: true,
                },
              },
              tenant: {
                select: {
                  firstName: true,
                  lastName: true,
                  businessName: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getCosaTemplateForEdit(templateId: string) {
  return prisma.cosaTemplate.findUnique({
    where: { id: templateId },
    select: {
      id: true,
      propertyId: true,
      meterId: true,
      name: true,
      allocationType: true,
      defaultAmount: true,
      isActive: true,
      property: {
        select: {
          name: true,
          propertyCode: true,
        },
      },
      meter: {
        select: {
          id: true,
          meterCode: true,
          utilityType: true,
        },
      },
      allocations: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          percentage: true,
          unitCount: true,
          amount: true,
          contract: {
            select: {
              id: true,
              status: true,
              paymentStartDate: true,
              property: {
                select: {
                  id: true,
                  parentPropertyId: true,
                  name: true,
                  propertyCode: true,
                  size: true,
                },
              },
              tenant: {
                select: {
                  firstName: true,
                  lastName: true,
                  businessName: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getInvoiceForView(invoiceId: string) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      tenantId: true,
      invoiceNumber: true,
      publicAccessCode: true,
      issueDate: true,
      dueDate: true,
      billingPeriodStart: true,
      billingPeriodEnd: true,
      subtotal: true,
      additionalCharges: true,
      discount: true,
      totalAmount: true,
      balanceDue: true,
      origin: true,
      status: true,
      notes: true,
      tenant: {
        select: {
          type: true,
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      contract: {
        select: {
          id: true,
          startDate: true,
          endDate: true,
          paymentStartDate: true,
          property: {
            select: {
              id: true,
              name: true,
              propertyCode: true,
              logoUrl: true,
              invoiceBrandingTemplate: {
                select: {
                  id: true,
                  name: true,
                  brandName: true,
                  brandSubtitle: true,
                  invoiceTitlePrefix: true,
                  logoUrl: true,
                  usePropertyLogo: true,
                  titleScale: true,
                  logoScalePercent: true,
                  brandNameSizePercent: true,
                  brandSubtitleSizePercent: true,
                  tenantNameSizePercent: true,
                  titleSizePercent: true,
                  brandNameWeight: true,
                  tenantNameWeight: true,
                  titleWeight: true,
                  accentColor: true,
                  labelColor: true,
                  valueColor: true,
                  mutedColor: true,
                  panelBackground: true,
                  isDefault: true,
                },
              },
            },
          },
        },
      },
      items: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          itemType: true,
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          contractRecurringCharge: {
            select: {
              id: true,
              label: true,
              chargeType: true,
            },
          },
          meterReading: {
            select: {
              id: true,
              readingDate: true,
              previousReading: true,
              currentReading: true,
              ratePerUnit: true,
              consumption: true,
              totalAmount: true,
              meter: {
                select: {
                  id: true,
                  meterCode: true,
                  utilityType: true,
                },
              },
            },
          },
          cosaAllocation: {
            select: {
              id: true,
              percentage: true,
              cosa: {
                select: {
                  id: true,
                  description: true,
                  billingDate: true,
                },
              },
            },
          },
          allocations: {
            orderBy: [{ createdAt: "asc" }],
            select: {
              id: true,
              amountAllocated: true,
              payment: {
                select: {
                  id: true,
                  paymentDate: true,
                  referenceNumber: true,
                  status: true,
                },
              },
            },
          },
        },
      },
      payments: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          amountPaid: true,
          paymentDate: true,
          dueDate: true,
          status: true,
          referenceNumber: true,
          notes: true,
          allocations: {
            select: {
              invoiceItemId: true,
              amountAllocated: true,
            },
          },
        },
      },
    },
  });
}

export async function getInvoiceForPublicView(invoiceId: string) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
      publicAccessCode: true,
      issueDate: true,
      dueDate: true,
      billingPeriodStart: true,
      billingPeriodEnd: true,
      subtotal: true,
      additionalCharges: true,
      discount: true,
      totalAmount: true,
      balanceDue: true,
      origin: true,
      status: true,
      notes: true,
      tenant: {
        select: {
          type: true,
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      contract: {
        select: {
          paymentStartDate: true,
          property: {
            select: {
              name: true,
              propertyCode: true,
              logoUrl: true,
              invoiceBrandingTemplate: {
                select: {
                  id: true,
                  name: true,
                  brandName: true,
                  brandSubtitle: true,
                  invoiceTitlePrefix: true,
                  logoUrl: true,
                  usePropertyLogo: true,
                  titleScale: true,
                  logoScalePercent: true,
                  brandNameSizePercent: true,
                  brandSubtitleSizePercent: true,
                  tenantNameSizePercent: true,
                  titleSizePercent: true,
                  brandNameWeight: true,
                  tenantNameWeight: true,
                  titleWeight: true,
                  accentColor: true,
                  labelColor: true,
                  valueColor: true,
                  mutedColor: true,
                  panelBackground: true,
                  isDefault: true,
                },
              },
            },
          },
        },
      },
      items: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          itemType: true,
          description: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          contractRecurringCharge: {
            select: {
              id: true,
              label: true,
              chargeType: true,
            },
          },
          cosaAllocation: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  });
}
