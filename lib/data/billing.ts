import "server-only";

import type { Prisma, UtilityType } from "@prisma/client";
import {
  filterCyclesWithoutInvoicedMonths,
  findNextCompletedBillingCycles,
  formatBillingCycleLabel,
  getBillingCycleKey,
  getBillingMonthKey,
} from "@/lib/billing/cycles";
import { getHistoricalBacklogCutoffDate, getHistoricalBacklogLatestDate } from "@/lib/billing/backlog";
import { prisma, withPrismaRetry } from "@/lib/prisma";

function getContractScopeKey(propertyId: string, tenantId: string) {
  return `${propertyId}:${tenantId}`;
}

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
  const contracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: [{ paymentStartDate: "asc" }],
    select: {
      id: true,
      tenantId: true,
      monthlyRent: true,
      endDate: true,
      paymentStartDate: true,
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
      recurringCharges: {
        where: {
          isActive: true,
        },
        orderBy: [{ effectiveStartDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          chargeType: true,
          label: true,
          amount: true,
          effectiveStartDate: true,
          effectiveEndDate: true,
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

  const contractScopeFilters = contracts.map((contract) => ({
    propertyId: contract.property.id,
    tenantId: contract.tenantId,
  }));

  const readings = contractScopeFilters.length
    ? await prisma.meterReading.findMany({
        where: {
          invoiceItem: null,
          meter: {
            isShared: false,
            OR: contractScopeFilters,
          },
        },
        orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          tenantId: true,
          readingDate: true,
          consumption: true,
          ratePerUnit: true,
          totalAmount: true,
          meter: {
            select: {
              propertyId: true,
              meterCode: true,
              utilityType: true,
            },
          },
        },
      })
    : [];

  const cosaAllocations = contracts.length
    ? await prisma.cOSAAllocation.findMany({
        where: {
          contractId: {
            in: contracts.map((contract) => contract.id),
          },
          invoiceItem: null,
        },
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          contractId: true,
          percentage: true,
          unitCount: true,
          computedAmount: true,
          cosa: {
            select: {
              id: true,
              description: true,
              billingDate: true,
              allocationType: true,
            },
          },
        },
      })
    : [];
  const deferredInvoiceBalances = contracts.length
    ? await prisma.deferredInvoiceBalance.findMany({
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
          sourceDescription: true,
          deferredAmount: true,
          sourceItemType: true,
          sourceInvoice: {
            select: {
              invoiceNumber: true,
              billingPeriodStart: true,
              billingPeriodEnd: true,
            },
          },
        },
      })
    : [];

  const readingsByScope = new Map<string, typeof readings>();
  const cosaAllocationsByContractId = new Map<string, typeof cosaAllocations>();
  const deferredBalancesByContractId = new Map<
    string,
    typeof deferredInvoiceBalances
  >();

  for (const reading of readings) {
    const scopeKey = getContractScopeKey(
      reading.meter.propertyId,
      reading.tenantId ?? ""
    );
    const entries = readingsByScope.get(scopeKey) ?? [];
    entries.push(reading);
    readingsByScope.set(scopeKey, entries);
  }

  for (const allocation of cosaAllocations) {
    if (!allocation.contractId) {
      continue;
    }

    const entries = cosaAllocationsByContractId.get(allocation.contractId) ?? [];
    entries.push(allocation);
    cosaAllocationsByContractId.set(allocation.contractId, entries);
  }

  for (const deferredBalance of deferredInvoiceBalances) {
    const entries =
      deferredBalancesByContractId.get(deferredBalance.contractId) ?? [];
    entries.push(deferredBalance);
    deferredBalancesByContractId.set(deferredBalance.contractId, entries);
  }

  return contracts.map((contract) => ({
    ...contract,
    monthlyRent: contract.monthlyRent.toString(),
    readings:
      readingsByScope.get(
        getContractScopeKey(contract.property.id, contract.tenantId)
      ) ?? [],
    rentAdjustments: contract.rentAdjustments.map((adjustment) => ({
      effectiveDate: adjustment.effectiveDate.toISOString(),
      increaseType: adjustment.increaseType,
      increaseValue: adjustment.increaseValue.toString(),
      calculationType: adjustment.calculationType,
      basedOn: adjustment.basedOn,
    })),
    recurringCharges: contract.recurringCharges.map((charge) => ({
      ...charge,
      amount: charge.amount.toString(),
      effectiveStartDate: charge.effectiveStartDate.toISOString(),
      effectiveEndDate: charge.effectiveEndDate?.toISOString() ?? null,
    })),
    cosaAllocations:
      (cosaAllocationsByContractId.get(contract.id) ?? []).map((allocation) => ({
        id: allocation.id,
        percentage: allocation.percentage.toString(),
        unitCount: allocation.unitCount,
        computedAmount: allocation.computedAmount.toString(),
        cosa: {
          id: allocation.cosa.id,
          description: allocation.cosa.description,
          billingDate: allocation.cosa.billingDate.toISOString(),
          allocationType: allocation.cosa.allocationType,
        },
      })),
    deferredBalances:
      (deferredBalancesByContractId.get(contract.id) ?? []).map((balance) => ({
        id: balance.id,
        sourceDescription: balance.sourceDescription,
        sourceItemType: balance.sourceItemType,
        deferredAmount: balance.deferredAmount.toString(),
        sourceInvoiceNumber: balance.sourceInvoice.invoiceNumber,
        sourceBillingPeriodStart:
          balance.sourceInvoice.billingPeriodStart.toISOString(),
        sourceBillingPeriodEnd:
          balance.sourceInvoice.billingPeriodEnd.toISOString(),
      })),
  }));
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
        fontFamily: true,
        showBrandName: true,
        showBrandSubtitle: true,
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
        fontFamily: true,
        showBrandName: true,
        showBrandSubtitle: true,
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
  return withPrismaRetry(async () => {
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
        advanceRentFirstMonths: true,
        advanceRentLastMonths: true,
        advanceRent: true,
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
        recurringCharges: {
          orderBy: [{ effectiveStartDate: "asc" }, { createdAt: "asc" }],
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
            openingReading: true,
          },
        })
      : [];

    const meterIds = meters.map((meter) => meter.id);
    const meterReadings = meterIds.length
      ? await prisma.meterReading.findMany({
          where: {
            meterId: {
              in: meterIds,
            },
          },
          orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            meterId: true,
            readingDate: true,
            currentReading: true,
            ratePerUnit: true,
          },
        })
      : [];

    const readingsByMeterId = new Map<string, typeof meterReadings>();

    for (const reading of meterReadings) {
      const entries = readingsByMeterId.get(reading.meterId) ?? [];
      entries.push(reading);
      readingsByMeterId.set(reading.meterId, entries);
    }

    const metersByContractScope = new Map<string, typeof meters>();

    for (const meter of meters) {
      const scopeKey = getContractScopeKey(
        meter.propertyId,
        meter.tenantId ?? ""
      );
      const entries = metersByContractScope.get(scopeKey) ?? [];
      entries.push(meter);
      metersByContractScope.set(scopeKey, entries);
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
        advanceRentFirstMonths: contract.advanceRentFirstMonths,
        advanceRentLastMonths: contract.advanceRentLastMonths,
        advanceRent: contract.advanceRent.toString(),
        rentAdjustments: contract.rentAdjustments.map((adjustment) => ({
          effectiveDate: adjustment.effectiveDate.toISOString(),
          increaseType: adjustment.increaseType,
          increaseValue: adjustment.increaseValue.toString(),
          calculationType: adjustment.calculationType,
          basedOn: adjustment.basedOn,
        })),
        property: contract.property,
        tenant: contract.tenant,
        recurringCharges: contract.recurringCharges.map((charge) => ({
          id: charge.id,
          chargeType: charge.chargeType,
          label: charge.label,
          amount: charge.amount.toString(),
          effectiveStartDate: charge.effectiveStartDate.toISOString(),
          effectiveEndDate: charge.effectiveEndDate?.toISOString() ?? null,
          isActive: charge.isActive,
        })),
        meters: (
          metersByContractScope.get(
            getContractScopeKey(contract.property.id, contract.tenantId)
          ) ?? []
        ).map((meter) => ({
          ...meter,
          openingReading: meter.openingReading.toString(),
          readings: (readingsByMeterId.get(meter.id) ?? []).map((reading) => ({
            id: reading.id,
            readingDate: reading.readingDate.toISOString(),
            currentReading: reading.currentReading.toString(),
            ratePerUnit: reading.ratePerUnit.toString(),
          })),
        })),
        pendingBacklogCycles: pendingBacklogCycles.map((cycle) => ({
          key: getBillingCycleKey(cycle.start, cycle.end),
          start: cycle.start.toISOString(),
          end: cycle.end.toISOString(),
          label: formatBillingCycleLabel(cycle),
        })),
      };
      })
      .filter((contract) => contract.pendingBacklogCycles.length > 0);
  });
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
          invoiceDescriptionDateDisplayDefault: true,
        },
      },
    },
  });
}

export async function getRecurringChargesOverview(): Promise<
  RecurringChargeOverviewItem[]
> {
  return prisma.contractRecurringCharge.findMany({
    where: {
      contract: {
        tenant: {
          status: "ACTIVE",
        },
      },
    },
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
      descriptionDateDisplayOverride: true,
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

export async function getCosaSharedMeterOptions(
  includeMeterId?: string,
  utilityType?: UtilityType
) {
  const meters = await prisma.utilityMeter.findMany({
    where: includeMeterId
      ? {
          OR: [
            {
              isShared: true,
              ...(utilityType ? { utilityType } : {}),
            },
            {
              id: includeMeterId,
            },
          ],
        }
      : {
          isShared: true,
          ...(utilityType ? { utilityType } : {}),
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
              description: true,
              billingDate: true,
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
      cosaDescription: reading.cosa?.description ?? null,
      cosaBillingDate: reading.cosa?.billingDate.toISOString() ?? null,
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
      calculationMode: true,
      quantity: true,
      unitRate: true,
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
          helperLabel: true,
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
      calculationMode: true,
      quantity: true,
      unitRate: true,
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
          helperLabel: true,
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
      calculationMode: true,
      dailyRate: true,
      isActive: true,
      property: {
        select: {
          id: true,
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
          helperLabel: true,
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
      calculationMode: true,
      dailyRate: true,
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
          helperLabel: true,
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

export async function getInvoiceAdjustmentsOverview() {
  return prisma.invoiceAdjustment.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      adjustmentType: true,
      valueType: true,
      enteredValue: true,
      calculatedAmount: true,
      label: true,
      source: true,
      createdAt: true,
      createdBy: {
        select: {
          displayName: true,
        },
      },
      targetInvoiceItem: {
        select: {
          description: true,
        },
      },
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          tenant: {
            select: {
              firstName: true,
              lastName: true,
              businessName: true,
            },
          },
          contract: {
            select: {
              property: {
                select: {
                  name: true,
                  propertyCode: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getSharedReadingHandoff(readingIds: string[]) {
  return prisma.meterReading.findMany({
    where: { id: { in: readingIds }, meter: { isShared: true } },
    orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      readingDate: true,
      consumption: true,
      ratePerUnit: true,
      totalAmount: true,
      cosa: { select: { id: true } },
      meter: {
        select: {
          id: true,
          meterCode: true,
          utilityType: true,
          property: { select: { id: true, name: true, propertyCode: true } },
          cosaTemplates: {
            where: { isActive: true },
            orderBy: [{ name: "asc" }],
            select: { id: true, name: true },
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
      createdAt: true,
      updatedAt: true,
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
          invoiceDescriptionDateDisplayDefault: true,
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
                  fontFamily: true,
                  showBrandName: true,
                  showBrandSubtitle: true,
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
          descriptionMode: true,
          customDescription: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          contractRecurringCharge: {
            select: {
              id: true,
              label: true,
              chargeType: true,
              descriptionDateDisplayOverride: true,
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
              unitCount: true,
              computedAmount: true,
              cosa: {
                select: {
                  id: true,
                  description: true,
                  billingDate: true,
                  totalAmount: true,
                  allocationType: true,
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
          invoiceDescriptionDateDisplayDefault: true,
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
                  fontFamily: true,
                  showBrandName: true,
                  showBrandSubtitle: true,
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
          descriptionMode: true,
          customDescription: true,
          quantity: true,
          unitPrice: true,
          amount: true,
          contractRecurringCharge: {
            select: {
              id: true,
              label: true,
              chargeType: true,
              descriptionDateDisplayOverride: true,
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
              unitCount: true,
              computedAmount: true,
              cosa: {
                select: {
                  id: true,
                  description: true,
                  billingDate: true,
                  totalAmount: true,
                  allocationType: true,
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
                },
              },
            },
          },
        },
      },
    },
  });
}
