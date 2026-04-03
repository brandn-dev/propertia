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
      invoiceItem: {
        select: {
          id: true,
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

function getContractPriority(status: string) {
  switch (status) {
    case "ACTIVE":
      return 0;
    case "DRAFT":
      return 1;
    case "EXPIRED":
      return 2;
    case "ENDED":
      return 3;
    case "TERMINATED":
      return 4;
    default:
      return 5;
  }
}

export async function getPropertyTenantBoard(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      name: true,
      propertyCode: true,
      status: true,
      category: true,
      isLeasable: true,
      location: true,
      parent: {
        select: {
          id: true,
          name: true,
          propertyCode: true,
        },
      },
      children: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          propertyCode: true,
          status: true,
          isLeasable: true,
          contracts: {
            orderBy: [{ startDate: "desc" }],
            select: {
              id: true,
              startDate: true,
              endDate: true,
              monthlyRent: true,
              status: true,
              tenant: {
                select: {
                  id: true,
                  type: true,
                  firstName: true,
                  lastName: true,
                  businessName: true,
                },
              },
            },
          },
        },
      },
      contracts: {
        orderBy: [{ startDate: "desc" }],
        select: {
          id: true,
          startDate: true,
          endDate: true,
          monthlyRent: true,
          status: true,
          tenant: {
            select: {
              id: true,
              type: true,
              firstName: true,
              lastName: true,
              businessName: true,
            },
          },
        },
      },
    },
  });

  if (!property) {
    return null;
  }

  const rawSpaces =
    property.children.length > 0
      ? property.children.filter(
          (child) => child.isLeasable || child.contracts.length > 0
        )
      : [
          {
            id: property.id,
            name: property.name,
            propertyCode: property.propertyCode,
            status: property.status,
            isLeasable: property.isLeasable,
            contracts: property.contracts,
          },
        ];

  const rows = rawSpaces
    .map((space) => {
      const preferredContract =
        [...space.contracts].sort(
          (left, right) =>
            getContractPriority(left.status) - getContractPriority(right.status)
        )[0] ?? null;

      return {
        id: space.id,
        name: space.name,
        propertyCode: space.propertyCode,
        status: space.status,
        contract: preferredContract,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));

  const activeRows = rows.filter((row) => row.contract?.status === "ACTIVE").length;

  return {
    property,
    rows,
    totalSpaces: rows.length,
    activeRows,
    vacantRows: rows.length - activeRows,
  };
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
          tenantPeople: true,
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
          rentAdjustments: true,
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
