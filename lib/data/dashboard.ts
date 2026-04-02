import "server-only";

import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/lib/auth/roles";
import { toNumber } from "@/lib/format";

export async function getAdminDashboardData() {
  const [
    propertyCount,
    activeContracts,
    openInvoices,
    receivables,
    recentInvoices,
    recentReadings,
  ] = await Promise.all([
    prisma.property.count({
      where: { status: "ACTIVE" },
    }),
    prisma.contract.count({
      where: { status: "ACTIVE" },
    }),
    prisma.invoice.count({
      where: {
        status: {
          in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"],
        },
      },
    }),
    prisma.invoice.aggregate({
      _sum: {
        balanceDue: true,
      },
      where: {
        status: {
          in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"],
        },
      },
    }),
    prisma.invoice.findMany({
      take: 6,
      orderBy: { dueDate: "asc" },
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        status: true,
        balanceDue: true,
        tenant: {
          select: {
            firstName: true,
            lastName: true,
            businessName: true,
          },
        },
      },
    }),
    prisma.meterReading.findMany({
      take: 5,
      orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        readingDate: true,
        consumption: true,
        totalAmount: true,
        tenant: {
          select: {
            firstName: true,
            lastName: true,
            businessName: true,
          },
        },
        meter: {
          select: {
            meterCode: true,
            utilityType: true,
            isShared: true,
            property: {
              select: { name: true },
            },
          },
        },
      },
    }),
  ]);

  return {
    propertyCount,
    activeContracts,
    openInvoices,
    outstandingBalance: toNumber(receivables._sum.balanceDue),
    recentInvoices,
    recentReadings,
  };
}

export async function getUtilityDashboardData() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [meterCount, sharedMeters, readingsThisMonth, recentReadings] =
    await Promise.all([
      prisma.utilityMeter.count(),
      prisma.utilityMeter.count({
        where: { isShared: true },
      }),
      prisma.meterReading.count({
        where: {
          readingDate: {
            gte: monthStart,
          },
        },
      }),
      prisma.meterReading.findMany({
        take: 8,
        orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          readingDate: true,
          consumption: true,
          totalAmount: true,
          tenant: {
            select: {
              firstName: true,
              lastName: true,
              businessName: true,
            },
          },
          meter: {
            select: {
              meterCode: true,
              utilityType: true,
              isShared: true,
              property: {
                select: { name: true },
              },
            },
          },
          recordedBy: {
            select: {
              displayName: true,
            },
          },
        },
      }),
    ]);

  return {
    meterCount,
    sharedMeters,
    readingsThisMonth,
    recentReadings,
  };
}

export async function getUtilitiesOverview() {
  const [meters, recentReadings] = await Promise.all([
    prisma.utilityMeter.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        meterCode: true,
        utilityType: true,
        isShared: true,
        tenant: {
          select: {
            firstName: true,
            lastName: true,
            businessName: true,
          },
        },
        property: {
          select: {
            name: true,
            propertyCode: true,
          },
        },
        _count: {
          select: {
            readings: true,
          },
        },
      },
    }),
    prisma.meterReading.findMany({
      take: 12,
      orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        readingDate: true,
        consumption: true,
        totalAmount: true,
        tenant: {
          select: {
            firstName: true,
            lastName: true,
            businessName: true,
          },
        },
        meter: {
          select: {
            meterCode: true,
            utilityType: true,
            isShared: true,
            property: {
              select: { name: true },
            },
          },
        },
        recordedBy: {
          select: { displayName: true },
        },
      },
    }),
  ]);

  return {
    meters,
    recentReadings,
  };
}

export async function getUtilityMetersOverview() {
  return prisma.utilityMeter.findMany({
    take: 30,
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      meterCode: true,
      utilityType: true,
      isShared: true,
      tenant: {
        select: {
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      property: {
        select: {
          name: true,
          propertyCode: true,
        },
      },
      _count: {
        select: {
          readings: true,
          cosas: true,
        },
      },
    },
  });
}

export async function getMeterReadingsOverview() {
  return prisma.meterReading.findMany({
    take: 30,
    orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      readingDate: true,
      previousReading: true,
      currentReading: true,
      consumption: true,
      ratePerUnit: true,
      totalAmount: true,
      tenant: {
        select: {
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      meter: {
        select: {
          meterCode: true,
          utilityType: true,
          isShared: true,
          property: {
            select: {
              name: true,
              propertyCode: true,
            },
          },
        },
      },
      recordedBy: {
        select: {
          displayName: true,
        },
      },
    },
  });
}

export async function getPropertiesOverview() {
  return prisma.property.findMany({
    take: 12,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      propertyCode: true,
      ownershipType: true,
      category: true,
      status: true,
      location: true,
      parent: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          children: true,
          contracts: true,
          utilityMeters: true,
        },
      },
    },
  });
}

export async function getTenantsOverview() {
  return prisma.tenant.findMany({
    take: 12,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      firstName: true,
      lastName: true,
      businessName: true,
      contactNumber: true,
      email: true,
      _count: {
        select: {
          contracts: true,
          invoices: true,
          representatives: true,
        },
      },
    },
  });
}

export async function getContractsOverview() {
  return prisma.contract.findMany({
    take: 12,
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    select: {
      id: true,
      startDate: true,
      endDate: true,
      monthlyRent: true,
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
      _count: {
        select: {
          recurringCharges: true,
        },
      },
    },
  });
}

export async function getBillingOverview() {
  return prisma.invoice.findMany({
    take: 12,
    orderBy: [{ dueDate: "asc" }, { issueDate: "desc" }],
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true,
      dueDate: true,
      billingPeriodStart: true,
      billingPeriodEnd: true,
      totalAmount: true,
      balanceDue: true,
      status: true,
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
      _count: {
        select: {
          items: true,
          payments: true,
        },
      },
    },
  });
}

export async function getDashboardDataForRole(role: AppRole) {
  return role === "ADMIN"
    ? { role, admin: await getAdminDashboardData() }
    : { role, utility: await getUtilityDashboardData() };
}
