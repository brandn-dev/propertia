import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
      status: true,
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
              name: true,
              propertyCode: true,
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
              meter: {
                select: {
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
      status: true,
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
