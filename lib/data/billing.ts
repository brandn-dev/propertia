import "server-only";

import { prisma } from "@/lib/prisma";

export async function getInvoiceGenerationContractOptions() {
  return prisma.contract.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: [{ paymentStartDate: "asc" }],
    select: {
      id: true,
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

export async function getRecurringChargesOverview() {
  return prisma.contractRecurringCharge.findMany({
    orderBy: [{ isActive: "desc" }, { effectiveStartDate: "asc" }],
    select: {
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
    },
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

export async function getInvoiceForView(invoiceId: string) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      invoiceNumber: true,
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
