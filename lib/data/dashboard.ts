import "server-only";

import type { Prisma } from "@prisma/client";
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
  DashboardCollectionsPoint,
  DashboardInvoiceStatusPoint,
  DashboardPaidEarningsPoint,
  DashboardRangePreset,
  DashboardSeriesByRange,
  DashboardUtilityChargesPoint,
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
const DASHBOARD_RANGE_PRESETS: DashboardRangePreset[] = [
  "30D",
  "60D",
  "90D",
  "12M",
  "ALL",
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

function getMonthYearLabel(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: APP_TIME_ZONE,
    month: "short",
    year: "numeric",
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

function createMonthBucketsBetween(start: Date, end: Date) {
  const firstMonth = startOfMonth(start);
  const lastMonth = startOfMonth(end);
  const buckets: Array<{ key: string; label: string; start: Date }> = [];

  for (
    let month = firstMonth;
    month.getTime() <= lastMonth.getTime();
    month = addMonths(month, 1)
  ) {
    buckets.push({
      key: getMonthKey(month) ?? `${month.getFullYear()}-${month.getMonth() + 1}`,
      label: getMonthLabel(month),
      start: month,
    });
  }

  return buckets;
}

function getPresetStart(
  preset: DashboardRangePreset,
  today: Date,
  earliestDate: Date
) {
  switch (preset) {
    case "30D":
      return addDays(today, -29);
    case "60D":
      return addDays(today, -59);
    case "90D":
      return addDays(today, -89);
    case "12M":
      return addMonths(startOfMonth(today), -11);
    case "ALL":
    default:
      return earliestDate;
  }
}

function getEarliestDashboardDate(
  dates: Array<Date | null | undefined>,
  fallback: Date
) {
  const values = dates
    .filter((value): value is Date => value instanceof Date)
    .map((value) => value.getTime());

  if (values.length === 0) {
    return fallback;
  }

  return new Date(Math.min(...values));
}

function isOpenInvoiceStatus(status: string): status is OpenInvoiceStatus {
  return (
    status === "ISSUED" ||
    status === "PARTIALLY_PAID" ||
    status === "OVERDUE"
  );
}

function getVisibleDashboardInvoiceWhere(
  extraWhere: Prisma.InvoiceWhereInput = {}
): Prisma.InvoiceWhereInput {
  return {
    AND: [
      extraWhere,
      {
        OR: [
          {
            tenant: {
              status: "ACTIVE",
            },
          },
          {
            tenant: {
              status: "ARCHIVED",
            },
            status: "PAID",
          },
        ],
      },
    ],
  };
}

type DashboardInvoiceSeriesRow = {
  issueDate: Date;
  dueDate: Date;
  totalAmount: Prisma.Decimal | number;
  balanceDue: Prisma.Decimal | number;
  status: string;
};

type DashboardPaymentSeriesRow = {
  amountPaid: Prisma.Decimal | number;
  invoice: {
    issueDate: Date;
  };
  allocations: Array<{
    amountAllocated: Prisma.Decimal | number;
    invoiceItem: {
      itemType: string;
    };
  }>;
};

type DashboardReadingSeriesRow = {
  readingDate: Date;
  totalAmount: Prisma.Decimal | number;
};

type DashboardCollectionsBucketRow = DashboardCollectionsPoint & {
  openInvoices: number;
};

function buildCollectionsBuckets(
  start: Date,
  end: Date,
  invoices: DashboardInvoiceSeriesRow[],
  payments: DashboardPaymentSeriesRow[]
) {
  const buckets = createMonthBucketsBetween(start, end);
  const bucketMap = new Map(
    buckets.map((bucket) => [
      bucket.key,
      {
        axisKey: bucket.key,
        label: bucket.label,
        tooltipLabel: getMonthYearLabel(bucket.start),
        billed: 0,
        collected: 0,
        outstanding: 0,
        openInvoices: 0,
      } satisfies DashboardCollectionsBucketRow,
    ])
  );

  for (const invoice of invoices) {
    if (invoice.issueDate.getTime() < start.getTime()) {
      continue;
    }

    const key = getMonthKey(invoice.issueDate);

    if (!key) {
      continue;
    }

    const bucket = bucketMap.get(key);

    if (!bucket) {
      continue;
    }

    bucket.billed += toNumber(invoice.totalAmount);

    if (isOpenInvoiceStatus(invoice.status)) {
      bucket.outstanding += toNumber(invoice.balanceDue);
      bucket.openInvoices += 1;
    }
  }

  for (const payment of payments) {
    if (payment.invoice.issueDate.getTime() < start.getTime()) {
      continue;
    }

    const key = getMonthKey(payment.invoice.issueDate);

    if (!key) {
      continue;
    }

    const bucket = bucketMap.get(key);

    if (bucket) {
      bucket.collected += toNumber(payment.amountPaid);
    }
  }

  return buckets.map((bucket) => {
    return (
      bucketMap.get(bucket.key) ?? {
        axisKey: bucket.key,
        label: bucket.label,
        tooltipLabel: getMonthYearLabel(bucket.start),
        billed: 0,
        collected: 0,
        outstanding: 0,
        openInvoices: 0,
      }
    );
  });
}

function buildUtilityBuckets(
  start: Date,
  end: Date,
  readings: DashboardReadingSeriesRow[]
) {
  const buckets = createMonthBucketsBetween(start, end);
  const bucketMap = new Map(
    buckets.map((bucket) => [
      bucket.key,
      {
        axisKey: bucket.key,
        label: bucket.label,
        tooltipLabel: getMonthYearLabel(bucket.start),
        charges: 0,
        readings: 0,
      } satisfies DashboardUtilityChargesPoint,
    ])
  );

  for (const reading of readings) {
    if (reading.readingDate.getTime() < start.getTime()) {
      continue;
    }

    const key = getMonthKey(reading.readingDate);

    if (!key) {
      continue;
    }

    const bucket = bucketMap.get(key);

    if (!bucket) {
      continue;
    }

    bucket.charges += toNumber(reading.totalAmount);
    bucket.readings += 1;
  }

  return buckets.map((bucket) => {
    return (
      bucketMap.get(bucket.key) ?? {
        axisKey: bucket.key,
        label: bucket.label,
        tooltipLabel: getMonthYearLabel(bucket.start),
        charges: 0,
        readings: 0,
      }
    );
  });
}

function buildPaidEarningsBuckets(
  start: Date,
  end: Date,
  payments: DashboardPaymentSeriesRow[]
) {
  const buckets = createMonthBucketsBetween(start, end);
  const bucketMap = new Map(
    buckets.map((bucket) => [
      bucket.key,
      {
        axisKey: bucket.key,
        label: bucket.label,
        tooltipLabel: getMonthYearLabel(bucket.start),
        rent: 0,
        charges: 0,
        cosa: 0,
        reading: 0,
        paidRevenue: 0,
      } satisfies DashboardPaidEarningsPoint,
    ])
  );

  for (const payment of payments) {
    if (payment.invoice.issueDate.getTime() < start.getTime()) {
      continue;
    }

    const key = getMonthKey(payment.invoice.issueDate);

    if (!key) {
      continue;
    }

    const bucket = bucketMap.get(key);

    if (!bucket) {
      continue;
    }

    if (payment.allocations.length === 0) {
      const fallbackAmount = toNumber(payment.amountPaid);
      bucket.charges += fallbackAmount;
      bucket.paidRevenue += fallbackAmount;
      continue;
    }

    for (const allocation of payment.allocations) {
      const allocatedAmount = toNumber(allocation.amountAllocated);

      switch (allocation.invoiceItem.itemType) {
        case "RENT":
          bucket.rent += allocatedAmount;
          break;
        case "COSA":
          bucket.cosa += allocatedAmount;
          break;
        case "UTILITY_READING":
          bucket.reading += allocatedAmount;
          break;
        default:
          bucket.charges += allocatedAmount;
          break;
      }

      bucket.paidRevenue += allocatedAmount;
    }
  }

  return buckets.map((bucket) => {
    return (
      bucketMap.get(bucket.key) ?? {
        axisKey: bucket.key,
        label: bucket.label,
        tooltipLabel: getMonthYearLabel(bucket.start),
        rent: 0,
        charges: 0,
        cosa: 0,
        reading: 0,
        paidRevenue: 0,
      }
    );
  });
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const today = startOfDay(new Date());
  const next60Days = addDays(today, 60);
  const nextSevenDays = addDays(today, 7);
  const cutoffDate = getHistoricalBacklogCutoffDate();

  const [
    visibleInvoices,
    paymentsForSeries,
    readingsForSeries,
    occupancyProperties,
    dueSoonInvoices,
    contractsExpiringSoonCount,
    expiringContracts,
    activeContractsForBilling,
    allActiveContracts,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: getVisibleDashboardInvoiceWhere(),
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
        invoice: getVisibleDashboardInvoiceWhere(),
      },
      orderBy: [{ invoice: { issueDate: "asc" } }, { paymentDate: "asc" }],
      select: {
        amountPaid: true,
        invoice: {
          select: {
            issueDate: true,
          },
        },
        allocations: {
          select: {
            amountAllocated: true,
            invoiceItem: {
              select: {
                itemType: true,
              },
            },
          },
        },
      },
    }),
    prisma.meterReading.findMany({
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
      where: getVisibleDashboardInvoiceWhere({
        status: {
          in: OPEN_INVOICE_STATUSES,
        },
      }),
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
    prisma.contract.findMany({
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
    }),
  ] as const);

  const earliestSeriesDate = startOfMonth(
    getEarliestDashboardDate(
      [
        visibleInvoices[0]?.issueDate,
        paymentsForSeries[0]?.invoice.issueDate,
        readingsForSeries[0]?.readingDate,
      ],
      today
    )
  );

  const collectionsByRange = {} as DashboardSeriesByRange<DashboardCollectionsPoint>;
  const utilityByRange = {} as DashboardSeriesByRange<DashboardUtilityChargesPoint>;
  const paidEarningsByRange = {} as DashboardSeriesByRange<DashboardPaidEarningsPoint>;
  const collectionBucketsByRange = new Map<
    DashboardRangePreset,
    DashboardCollectionsBucketRow[]
  >();

  for (const preset of DASHBOARD_RANGE_PRESETS) {
    const rangeStart = getPresetStart(preset, today, earliestSeriesDate);
    const collectionBuckets = buildCollectionsBuckets(
      rangeStart,
      today,
      visibleInvoices,
      paymentsForSeries
    );

    collectionBucketsByRange.set(preset, collectionBuckets);
    collectionsByRange[preset] = collectionBuckets.map((bucket) => ({
      label: bucket.label,
      billed: bucket.billed,
      collected: bucket.collected,
      outstanding: bucket.outstanding,
    }));
    utilityByRange[preset] = buildUtilityBuckets(
      rangeStart,
      today,
      readingsForSeries
    );
    paidEarningsByRange[preset] = buildPaidEarningsBuckets(
      rangeStart,
      today,
      paymentsForSeries
    );
  }

  let openInvoices = 0;
  let outstandingBalance = 0;
  let overdueInvoicesCount = 0;
  let dueThisWeekCount = 0;
  const statusCounts = new Map<DashboardInvoiceStatusPoint["status"], number>(
    STATUS_MIX_ORDER.map((status) => [status, 0])
  );

  for (const invoice of visibleInvoices) {
    const invoiceStatus = invoice.status as DashboardInvoiceStatusPoint["status"];
    statusCounts.set(invoiceStatus, (statusCounts.get(invoiceStatus) ?? 0) + 1);

    if (!isOpenInvoiceStatus(invoice.status)) {
      continue;
    }

    openInvoices += 1;
    outstandingBalance += toNumber(invoice.balanceDue);

    if (invoice.status === "OVERDUE") {
      overdueInvoicesCount += 1;
    }

    const dueDateMs = invoice.dueDate.getTime();

    if (dueDateMs >= today.getTime() && dueDateMs <= nextSevenDays.getTime()) {
      dueThisWeekCount += 1;
    }
  }

  const invoiceStatusMix = STATUS_MIX_ORDER.map((status) => ({
    status,
    label: status.replaceAll("_", " "),
    value: statusCounts.get(status) ?? 0,
  })).filter((row) => row.value > 0);

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
  const occupiedTrend = occupancyByBuilding.slice(0, 6).map((building) => ({
    label: building.buildingLabel,
    value: building.occupied,
  }));
  const kpiCollectionTrend = collectionBucketsByRange.get("12M") ?? [];

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
        trend:
          kpiCollectionTrend.length > 0
            ? kpiCollectionTrend.map((bucket) => ({
                label: bucket.label,
                value: bucket.openInvoices,
              }))
            : [{ label: "None", value: 0 }],
      },
      {
        key: "outstandingBalance",
        label: "Outstanding balance",
        value: outstandingBalance,
        detail: "Across unpaid invoices",
        trend:
          kpiCollectionTrend.length > 0
            ? kpiCollectionTrend.map((bucket) => ({
                label: bucket.label,
                value: bucket.outstanding,
              }))
            : [{ label: "None", value: 0 }],
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
      collections: collectionsByRange,
      utilityCharges: utilityByRange,
      paidEarnings: paidEarningsByRange,
    },
    breakdowns: {
      occupancyByBuilding,
      invoiceStatusSummary: {
        totalVisible: visibleInvoices.length,
        paid: statusCounts.get("PAID") ?? 0,
        open: openInvoices,
        byStatus: invoiceStatusMix,
      },
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
          invoiceDescriptionDateDisplayDefault: true,
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
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      startDate: true,
      endDate: true,
      monthlyRent: true,
      status: true,
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
          invoiceDescriptionDateDisplayDefault: true,
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
          descriptionMode: true,
          customDescription: true,
          amount: true,
          contractRecurringCharge: {
            select: {
              id: true,
              label: true,
              chargeType: true,
              descriptionDateDisplayOverride: true,
            },
          },
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
