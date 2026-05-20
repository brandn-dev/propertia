import "server-only";

import {
  filterCyclesWithoutInvoicedMonths,
  findNextCompletedBillingCycles,
  getBillingCycleKey,
  getBillingMonthKey,
} from "@/lib/billing/cycles";
import { getHistoricalBacklogCutoffDate } from "@/lib/billing/backlog";
import type { AuthUser } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { usesAdminWorkspace, type AppRole } from "@/lib/auth/roles";
import { APP_TIME_ZONE, getDatePartsInAppTimeZone, toNumber } from "@/lib/format";
import type {
  AdminDashboardData,
  DashboardInvoiceStatusPoint,
} from "@/lib/data/dashboard-types";

type OpenInvoiceStatus = "ISSUED" | "PARTIALLY_PAID" | "OVERDUE";

const OPEN_INVOICE_STATUSES: OpenInvoiceStatus[] = [
  "ISSUED",
  "PARTIALLY_PAID",
  "OVERDUE",
];
const STATUS_MIX_ORDER: DashboardInvoiceStatusPoint["status"][] = [
  "OVERDUE",
  "PARTIALLY_PAID",
  "ISSUED",
  "PAID",
];

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfMonth(date: Date) {
  const value = startOfDay(date);
  value.setDate(1);
  return value;
}

function addDays(date: Date, amount: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + amount);
  return value;
}

function addMonths(date: Date, amount: number) {
  const value = new Date(date);
  value.setMonth(value.getMonth() + amount);
  return value;
}

function formatTenantName(tenant: {
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Unassigned"
  );
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: APP_TIME_ZONE,
    month: "short",
  }).format(date);
}

function getMonthKey(value: Date | string) {
  const parts = getDatePartsInAppTimeZone(value);

  if (!parts) {
    return null;
  }

  return `${parts.year}-${parts.month}`;
}

function createMonthBuckets(count: number) {
  const currentMonth = startOfMonth(new Date());
  const firstMonth = addMonths(currentMonth, -(count - 1));

  return Array.from({ length: count }, (_, index) => {
    const date = addMonths(firstMonth, index);

    return {
      key: getMonthKey(date) ?? `${date.getFullYear()}-${date.getMonth() + 1}`,
      label: getMonthLabel(date),
      start: date,
    };
  });
}

function isOpenInvoiceStatus(status: string): status is OpenInvoiceStatus {
  return (
    status === "ISSUED" ||
    status === "PARTIALLY_PAID" ||
    status === "OVERDUE"
  );
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const today = startOfDay(new Date());
  const next60Days = addDays(today, 60);
  const cutoffDate = getHistoricalBacklogCutoffDate();
  const monthBuckets = createMonthBuckets(6);
  const monthWindowStart = monthBuckets[0]?.start ?? startOfMonth(new Date());

  const [
    openInvoices,
    receivables,
    overdueInvoicesCount,
    dueThisWeekCount,
    invoicesForSeries,
    paymentsForSeries,
    statusMixRows,
    readingsForSeries,
    occupancyProperties,
    dueSoonInvoices,
    contractsExpiringSoonCount,
    expiringContracts,
    activeContractsForBilling,
  ] = await Promise.all([
    prisma.invoice.count({
      where: {
        status: {
          in: OPEN_INVOICE_STATUSES,
        },
      },
    }),
    prisma.invoice.aggregate({
      _sum: {
        balanceDue: true,
      },
      where: {
        status: {
          in: OPEN_INVOICE_STATUSES,
        },
      },
    }),
    prisma.invoice.count({
      where: {
        status: "OVERDUE",
      },
    }),
    prisma.invoice.count({
      where: {
        status: {
          in: OPEN_INVOICE_STATUSES,
        },
        dueDate: {
          gte: today,
          lte: addDays(today, 7),
        },
      },
    }),
    prisma.invoice.findMany({
      where: {
        issueDate: {
          gte: monthWindowStart,
        },
      },
      orderBy: {
        issueDate: "asc",
      },
      select: {
        issueDate: true,
        dueDate: true,
        totalAmount: true,
        balanceDue: true,
        status: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        status: "SETTLED",
        paymentDate: {
          gte: monthWindowStart,
        },
      },
      orderBy: {
        paymentDate: "asc",
      },
      select: {
        paymentDate: true,
        amountPaid: true,
      },
    }),
    Promise.all(
      STATUS_MIX_ORDER.map((status) =>
        prisma.invoice.count({
          where: {
            status,
          },
        })
      )
    ),
    prisma.meterReading.findMany({
      where: {
        readingDate: {
          gte: monthWindowStart,
        },
      },
      orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
      select: {
        readingDate: true,
        totalAmount: true,
      },
    }),
    prisma.property.findMany({
      where: {
        status: {
          in: ["ACTIVE", "UNDER_MAINTENANCE"],
        },
      },
      select: {
        id: true,
        name: true,
        propertyCode: true,
        category: true,
        status: true,
        isLeasable: true,
        parentPropertyId: true,
        parent: {
          select: {
            id: true,
            name: true,
            propertyCode: true,
          },
        },
        contracts: {
          where: {
            status: "ACTIVE",
          },
          select: {
            id: true,
          },
        },
        _count: {
          select: {
            children: true,
          },
        },
      },
    }),
    prisma.invoice.findMany({
      take: 6,
      where: {
        status: {
          in: OPEN_INVOICE_STATUSES,
        },
      },
      orderBy: [{ dueDate: "asc" }, { issueDate: "asc" }],
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
        contract: {
          select: {
            property: {
              select: {
                name: true,
                parent: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.contract.count({
      where: {
        status: "ACTIVE",
        endDate: {
          gte: today,
          lte: next60Days,
        },
      },
    }),
    prisma.contract.findMany({
      take: 6,
      where: {
        status: "ACTIVE",
        endDate: {
          gte: today,
        },
      },
      orderBy: {
        endDate: "asc",
      },
      select: {
        id: true,
        endDate: true,
        monthlyRent: true,
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
            parent: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.contract.findMany({
      where: {
        status: "ACTIVE",
        paymentStartDate: {
          lte: today,
        },
        endDate: {
          gte: today,
        },
      },
      select: {
        id: true,
        endDate: true,
        paymentStartDate: true,
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
            parent: {
              select: {
                name: true,
              },
            },
          },
        },
        invoices: {
          select: {
            billingPeriodStart: true,
            billingPeriodEnd: true,
          },
        },
      },
    }),
  ] as const);

  const collectionsMap = new Map(
    monthBuckets.map((bucket) => [
      bucket.key,
      {
        label: bucket.label,
        billed: 0,
        collected: 0,
        outstanding: 0,
        openInvoices: 0,
        expiringContracts: 0,
        utilityCharges: 0,
        readings: 0,
      },
    ])
  );

  for (const invoice of invoicesForSeries) {
    const key = getMonthKey(invoice.issueDate);

    if (!key) {
      continue;
    }

    const bucket = collectionsMap.get(key);

    if (!bucket) {
      continue;
    }

    bucket.billed += toNumber(invoice.totalAmount);

    if (isOpenInvoiceStatus(invoice.status)) {
      bucket.outstanding += toNumber(invoice.balanceDue);
      bucket.openInvoices += 1;
    }
  }

  for (const payment of paymentsForSeries) {
    if (!payment.paymentDate) {
      continue;
    }

    const key = getMonthKey(payment.paymentDate);

    if (!key) {
      continue;
    }

    const bucket = collectionsMap.get(key);

    if (bucket) {
      bucket.collected += toNumber(payment.amountPaid);
    }
  }

  for (const reading of readingsForSeries) {
    const key = getMonthKey(reading.readingDate);

    if (!key) {
      continue;
    }

    const bucket = collectionsMap.get(key);

    if (!bucket) {
      continue;
    }

    bucket.utilityCharges += toNumber(reading.totalAmount);
    bucket.readings += 1;
  }

  const occupancyMap = new Map<
    string,
    { buildingId: string; buildingLabel: string; occupied: number; vacant: number }
  >();

  for (const property of occupancyProperties) {
    const hasActiveContract = property.contracts.length > 0;
    const isChildSpace =
      Boolean(property.parentPropertyId) &&
      (property.isLeasable || hasActiveContract || property.category === "COMMERCIAL_SPACE");
    const isStandaloneSpace =
      !property.parentPropertyId &&
      property._count.children === 0 &&
      (property.isLeasable || hasActiveContract || property.category === "COMMERCIAL_SPACE");

    if (!isChildSpace && !isStandaloneSpace) {
      continue;
    }

    const buildingId = property.parent?.id ?? property.id;
    const buildingLabel = property.parent?.name ?? property.name;
    const row =
      occupancyMap.get(buildingId) ??
      {
        buildingId,
        buildingLabel,
        occupied: 0,
        vacant: 0,
      };

    if (hasActiveContract) {
      row.occupied += 1;
    } else {
      row.vacant += 1;
    }

    occupancyMap.set(buildingId, row);
  }

  const occupancyByBuilding = [...occupancyMap.values()]
    .map((row) => {
      const total = row.occupied + row.vacant;

      return {
        ...row,
        total,
        occupancyRate: total === 0 ? 0 : row.occupied / total,
      };
    })
    .sort((left, right) => {
      if (right.total !== left.total) {
        return right.total - left.total;
      }

      return left.buildingLabel.localeCompare(right.buildingLabel);
    });

  const occupiedSpaces = occupancyByBuilding.reduce(
    (total, building) => total + building.occupied,
    0
  );
  const totalSpaces = occupancyByBuilding.reduce(
    (total, building) => total + building.total,
    0
  );

  const nextSixMonths = createMonthBuckets(6).map((bucket) => ({
    ...bucket,
    value: 0,
  }));

  const expiringTrendMap = new Map(nextSixMonths.map((bucket) => [bucket.key, bucket]));

  const allActiveContracts = await prisma.contract.findMany({
    where: {
      status: "ACTIVE",
      endDate: {
        gte: today,
        lt: addMonths(startOfMonth(today), 6),
      },
    },
    select: {
      endDate: true,
    },
  });

  for (const contract of allActiveContracts) {
    const key = getMonthKey(contract.endDate);

    if (!key) {
      continue;
    }

    const bucket = expiringTrendMap.get(key);

    if (bucket) {
      bucket.value += 1;
    }
  }

  const collections = monthBuckets.map((bucket) => {
    const row = collectionsMap.get(bucket.key);

    return {
      label: bucket.label,
      billed: row?.billed ?? 0,
      collected: row?.collected ?? 0,
      outstanding: row?.outstanding ?? 0,
    };
  });

  const utilityCharges = monthBuckets.map((bucket) => {
    const row = collectionsMap.get(bucket.key);

    return {
      label: bucket.label,
      charges: row?.utilityCharges ?? 0,
      readings: row?.readings ?? 0,
    };
  });

  const invoiceStatusMix = STATUS_MIX_ORDER.map((status, index) => {
    return {
      status,
      label: status.replaceAll("_", " "),
      value: statusMixRows[index] ?? 0,
    };
  }).filter((row) => row.value > 0);

  const outstandingBalance = toNumber(receivables._sum.balanceDue ?? 0);
  const occupiedTrend = occupancyByBuilding.slice(0, 6).map((building) => ({
    label: building.buildingLabel,
    value: building.occupied,
  }));

  const nearestBillables = activeContractsForBilling
    .map((contract) => {
      const existingPeriods = new Set(
        contract.invoices.map((invoice) =>
          getBillingCycleKey(invoice.billingPeriodStart, invoice.billingPeriodEnd)
        )
      );
      const existingMonths = new Set(
        contract.invoices.map((invoice) =>
          getBillingMonthKey(invoice.billingPeriodStart)
        )
      );
      const nextCycle = filterCyclesWithoutInvoicedMonths(
        findNextCompletedBillingCycles({
          anchorDate: contract.paymentStartDate,
          contractEndDate: contract.endDate,
          issueDate: today,
          existingPeriods,
          includeCurrentCycle: true,
          includeNextCycleInIssueMonth: true,
        }),
        existingMonths
      ).find((cycle) => cycle.end >= cutoffDate);

      if (!nextCycle) {
        return null;
      }

      return {
        contractId: contract.id,
        tenantName: formatTenantName(contract.tenant),
        propertyName: contract.property.parent?.name ?? contract.property.name,
        cycleStart: nextCycle.start.toISOString(),
        cycleEnd: nextCycle.end.toISOString(),
      };
    })
    .filter(
      (
        item
      ): item is {
        contractId: string;
        tenantName: string;
        propertyName: string;
        cycleStart: string;
        cycleEnd: string;
      } => item !== null
    )
    .sort((left, right) => {
      if (!left || !right) {
        return 0;
      }

      return (
        new Date(left.cycleStart).getTime() - new Date(right.cycleStart).getTime()
      );
    })
    .slice(0, 4);

  return {
    kpis: [
      {
        key: "openInvoices",
        label: "Open invoices",
        value: openInvoices,
        detail: "Awaiting settlement",
        trend: monthBuckets.map((bucket) => ({
          label: bucket.label,
          value: collectionsMap.get(bucket.key)?.openInvoices ?? 0,
        })),
      },
      {
        key: "outstandingBalance",
        label: "Outstanding balance",
        value: outstandingBalance,
        detail: "Across unpaid invoices",
        trend: monthBuckets.map((bucket) => ({
          label: bucket.label,
          value: collectionsMap.get(bucket.key)?.outstanding ?? 0,
        })),
      },
      {
        key: "occupiedSpaces",
        label: "Occupied spaces",
        value: occupiedSpaces,
        detail: `${occupiedSpaces} of ${totalSpaces || 0} leased`,
        trend:
          occupiedTrend.length > 0
            ? occupiedTrend
            : [{ label: "None", value: 0 }],
      },
      {
        key: "contractsExpiringSoon",
        label: "Expiring soon",
        value: contractsExpiringSoonCount,
        detail: "Next 60 days",
        trend: nextSixMonths.map((bucket) => ({
          label: bucket.label,
          value: bucket.value,
        })),
      },
    ],
    series: {
      collections,
      utilityCharges,
    },
    breakdowns: {
      occupancyByBuilding,
      invoiceStatusMix,
    },
    queues: {
      dueSoon: dueSoonInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dueDate: invoice.dueDate.toISOString(),
        balanceDue: toNumber(invoice.balanceDue),
        status: invoice.status as OpenInvoiceStatus,
        tenantName: formatTenantName(invoice.tenant),
        propertyName:
          invoice.contract.property.parent?.name ?? invoice.contract.property.name,
      })),
      expiringContracts: expiringContracts.map((contract) => ({
        id: contract.id,
        endDate: contract.endDate.toISOString(),
        monthlyRent: toNumber(contract.monthlyRent),
        tenantName: formatTenantName(contract.tenant),
        propertyName: contract.property.parent?.name ?? contract.property.name,
      })),
    },
    reminders: {
      items: [
        {
          label: "Overdue invoices",
          value: String(overdueInvoicesCount),
          tone: overdueInvoicesCount > 0 ? "critical" : "default",
          detail: overdueInvoicesCount > 0 ? "Needs collection follow-up" : "Nothing overdue",
        },
        {
          label: "Due this week",
          value: String(dueThisWeekCount),
          tone: dueThisWeekCount > 0 ? "warning" : "default",
          detail: dueThisWeekCount > 0 ? "Upcoming billing deadlines" : "No bills due soon",
        },
        {
          label: "Expiring in 60 days",
          value: String(contractsExpiringSoonCount),
          tone: contractsExpiringSoonCount > 0 ? "warning" : "default",
          detail:
            contractsExpiringSoonCount > 0
              ? "Review renewals and extensions"
              : "No immediate renewals",
        },
      ],
      nearestBillables,
    },
    summary: {
      openInvoices,
      outstandingBalance,
      occupiedSpaces,
      totalSpaces,
      contractsExpiringSoon: contractsExpiringSoonCount,
    },
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
      retiredAt: true,
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
  const readings = await prisma.meterReading.findMany({
    orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      meterId: true,
      readingDate: true,
      previousReading: true,
      currentReading: true,
      consumption: true,
      ratePerUnit: true,
      totalAmount: true,
      origin: true,
      tenant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      meter: {
        select: {
          id: true,
          meterCode: true,
          utilityType: true,
          isShared: true,
          property: {
            select: {
              id: true,
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
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
        },
      },
    },
  });

  const metersWithLaterBilledReadings = new Set<string>();
  const rows: Array<(typeof readings)[number] & { canEdit: boolean }> = [];

  for (const reading of readings) {
    rows.push({
      ...reading,
      canEdit:
        !reading.invoiceItem &&
        !metersWithLaterBilledReadings.has(reading.meterId),
    });

    if (reading.invoiceItem) {
      metersWithLaterBilledReadings.add(reading.meterId);
    }
  }

  return rows;
}

export async function getPropertiesOverview() {
  return prisma.property.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      propertyCode: true,
      ownershipType: true,
      category: true,
      status: true,
      location: true,
      isLeasable: true,
      parentPropertyId: true,
      contracts: {
        where: {
          status: "ACTIVE",
        },
        take: 1,
        orderBy: [{ startDate: "desc" }],
        select: {
          tenant: {
            select: {
              businessName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      parent: {
        select: {
          propertyCode: true,
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
    orderBy: [{ status: "asc" }, { archivedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      status: true,
      firstName: true,
      lastName: true,
      businessName: true,
      contactNumber: true,
      email: true,
      archivedAt: true,
      _count: {
        select: {
          contracts: true,
          invoices: true,
          tenantPeople: true,
          representatives: true,
        },
      },
      contracts: {
        orderBy: [{ startDate: "desc" }],
        select: {
          id: true,
          status: true,
          startDate: true,
          property: {
            select: {
              id: true,
              name: true,
              propertyCode: true,
              parent: {
                select: {
                  id: true,
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

export async function getPeopleOverview() {
  return prisma.person.findMany({
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      contactNumber: true,
      email: true,
      tenantLinks: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          positionTitle: true,
          isPrimary: true,
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
      _count: {
        select: {
          tenantLinks: true,
        },
      },
    },
  });
}

export async function getContractsOverview() {
  return prisma.contract.findMany({
    where: {
      tenant: {
        status: "ACTIVE",
      },
    },
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
    where: {
      tenant: {
        status: "ACTIVE",
      },
    },
    orderBy: [{ dueDate: "asc" }, { issueDate: "desc" }],
    select: {
      id: true,
      tenantId: true,
      invoiceNumber: true,
      issueDate: true,
      dueDate: true,
      billingPeriodStart: true,
      billingPeriodEnd: true,
      totalAmount: true,
      balanceDue: true,
      origin: true,
      status: true,
      tenant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      contract: {
        select: {
          id: true,
          property: {
            select: {
              id: true,
              name: true,
              propertyCode: true,
              parent: {
                select: {
                  id: true,
                  name: true,
                  propertyCode: true,
                },
              },
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
      items: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          itemType: true,
          description: true,
          amount: true,
          allocations: {
            select: {
              amountAllocated: true,
            },
          },
        },
      },
    },
  });
}

export async function getDashboardDataForRole(role: AppRole) {
  return role === "ADMIN"
    ? { kind: "admin" as const, role, admin: await getAdminDashboardData() }
    : { kind: "utility" as const, role, utility: await getUtilityDashboardData() };
}

export async function getDashboardDataForUser(
  user: Pick<AuthUser, "role" | "capabilities">
) {
  return usesAdminWorkspace(user)
    ? {
        kind: "admin" as const,
        role: user.role,
        admin: await getAdminDashboardData(),
      }
    : {
        kind: "utility" as const,
        role: user.role,
        utility: await getUtilityDashboardData(),
      };
}
