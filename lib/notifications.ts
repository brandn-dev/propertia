import "server-only";

import { after } from "next/server";
import type { AuthUser } from "@/lib/auth/user";
import { formatDate } from "@/lib/format";
import type {
  NotificationInbox,
  NotificationSummary,
} from "@/lib/notification-types";
import { prisma } from "@/lib/prisma";

const SYSTEM_NOTIFICATION_KINDS = [
  "INVOICE_DUE_SOON",
  "INVOICE_OVERDUE",
  "CONTRACT_EXPIRING",
  "SHARED_READING_READY",
  "METER_READING_MISSING",
] as const;

type SystemNotificationKind = (typeof SYSTEM_NOTIFICATION_KINDS)[number];

type NotificationDraft = {
  kind: SystemNotificationKind;
  severity: "INFO" | "WARNING" | "CRITICAL";
  dedupeKey: string;
  title: string;
  message: string;
  href?: string;
  sourceType?: string;
  sourceId?: string;
  expiresAt?: Date;
};

function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatTenantLabel(tenant: {
  businessName: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  return (
    tenant.businessName ||
    [tenant.firstName, tenant.lastName].filter(Boolean).join(" ") ||
    "Tenant"
  );
}

async function buildAdminNotifications(): Promise<NotificationDraft[]> {
  const today = startOfDay();
  const dueSoonLimit = endOfDay(addDays(today, 7));
  const expiringLimit = endOfDay(addDays(today, 30));
  const currentMonthStart = startOfMonth(today);
  const currentMonthEnd = endOfMonth(today);

  const [
    overdueInvoices,
    dueSoonInvoices,
    expiringContracts,
    sharedReadingsReady,
    sharedMeters,
  ] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        status: {
          in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"],
        },
        balanceDue: {
          gt: 0,
        },
        dueDate: {
          lt: today,
        },
      },
      orderBy: [{ dueDate: "asc" }],
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        tenant: {
          select: {
            businessName: true,
            firstName: true,
            lastName: true,
          },
        },
        contract: {
          select: {
            property: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.invoice.findMany({
      where: {
        status: {
          in: ["ISSUED", "PARTIALLY_PAID"],
        },
        balanceDue: {
          gt: 0,
        },
        dueDate: {
          gte: today,
          lte: dueSoonLimit,
        },
      },
      orderBy: [{ dueDate: "asc" }],
      select: {
        id: true,
        invoiceNumber: true,
        dueDate: true,
        tenant: {
          select: {
            businessName: true,
            firstName: true,
            lastName: true,
          },
        },
        contract: {
          select: {
            property: {
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
        endDate: {
          gte: today,
          lte: expiringLimit,
        },
      },
      orderBy: [{ endDate: "asc" }],
      select: {
        id: true,
        endDate: true,
        tenant: {
          select: {
            businessName: true,
            firstName: true,
            lastName: true,
          },
        },
        property: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.meterReading.findMany({
      where: {
        readingDate: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
        meter: {
          isShared: true,
        },
        cosa: null,
      },
      orderBy: [{ readingDate: "desc" }],
      select: {
        id: true,
        readingDate: true,
        meter: {
          select: {
            id: true,
            meterCode: true,
            utilityType: true,
            property: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.utilityMeter.findMany({
      where: {
        isShared: true,
        property: {
          status: {
            not: "ARCHIVED",
          },
        },
      },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        meterCode: true,
        utilityType: true,
        property: {
          select: {
            name: true,
          },
        },
        readings: {
          where: {
            readingDate: {
              gte: currentMonthStart,
              lte: currentMonthEnd,
            },
          },
          take: 1,
          select: {
            id: true,
          },
        },
      },
    }),
  ]);

  const notifications: NotificationDraft[] = [
    ...overdueInvoices.map((invoice) => ({
      kind: "INVOICE_OVERDUE" as const,
      severity: "CRITICAL" as const,
      dedupeKey: `invoice-overdue:${invoice.id}`,
      title: `Invoice ${invoice.invoiceNumber} is overdue`,
      message: `${formatTenantLabel(invoice.tenant)} · ${invoice.contract.property.name} · due ${formatDate(invoice.dueDate)}`,
      href: `/billing/${invoice.id}`,
      sourceType: "INVOICE",
      sourceId: invoice.id,
    })),
    ...dueSoonInvoices.map((invoice) => ({
      kind: "INVOICE_DUE_SOON" as const,
      severity: "WARNING" as const,
      dedupeKey: `invoice-due-soon:${invoice.id}`,
      title: `Invoice ${invoice.invoiceNumber} is due soon`,
      message: `${formatTenantLabel(invoice.tenant)} · ${invoice.contract.property.name} · due ${formatDate(invoice.dueDate)}`,
      href: `/billing/${invoice.id}`,
      sourceType: "INVOICE",
      sourceId: invoice.id,
    })),
    ...expiringContracts.map((contract) => ({
      kind: "CONTRACT_EXPIRING" as const,
      severity: "WARNING" as const,
      dedupeKey: `contract-expiring:${contract.id}`,
      title: `${formatTenantLabel(contract.tenant)} contract is expiring`,
      message: `${contract.property.name} · ends ${formatDate(contract.endDate)}`,
      href: `/contracts/${contract.id}/edit`,
      sourceType: "CONTRACT",
      sourceId: contract.id,
    })),
    ...sharedReadingsReady.map((reading) => ({
      kind: "SHARED_READING_READY" as const,
      severity: "INFO" as const,
      dedupeKey: `shared-reading-ready:${reading.id}`,
      title: `${reading.meter.utilityType} shared reading is ready for COSA`,
      message: `${reading.meter.property.name} · ${reading.meter.meterCode} · ${formatDate(reading.readingDate)}`,
      href: "/billing/cosa",
      sourceType: "METER_READING",
      sourceId: reading.id,
    })),
    ...sharedMeters
      .filter((meter) => meter.readings.length === 0)
      .map((meter) => ({
        kind: "METER_READING_MISSING" as const,
        severity: "WARNING" as const,
        dedupeKey: `missing-reading:${meter.id}:${getMonthKey(today)}`,
        title: `${meter.utilityType} shared meter is missing this month's reading`,
        message: `${meter.property.name} · ${meter.meterCode}`,
        href: "/utilities/readings/new",
        sourceType: "UTILITY_METER",
        sourceId: meter.id,
      })),
  ];

  return notifications;
}

async function buildMeterReaderNotifications(): Promise<NotificationDraft[]> {
  const today = startOfDay();
  const currentMonthStart = startOfMonth(today);
  const currentMonthEnd = endOfMonth(today);

  const meters = await prisma.utilityMeter.findMany({
    where: {
      property: {
        status: {
          not: "ARCHIVED",
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      meterCode: true,
      utilityType: true,
      isShared: true,
      property: {
        select: {
          name: true,
        },
      },
      tenant: {
        select: {
          businessName: true,
          firstName: true,
          lastName: true,
        },
      },
      readings: {
        where: {
          readingDate: {
            gte: currentMonthStart,
            lte: currentMonthEnd,
          },
        },
        take: 1,
        select: {
          id: true,
        },
      },
    },
  });

  return meters
    .filter((meter) => meter.readings.length === 0)
    .map((meter) => ({
      kind: "METER_READING_MISSING" as const,
      severity: "WARNING" as const,
      dedupeKey: `missing-reading:${meter.id}:${getMonthKey(today)}`,
      title: `${meter.utilityType} meter needs this month's reading`,
      message: meter.isShared
        ? `${meter.property.name} · ${meter.meterCode}`
        : `${formatTenantLabel(meter.tenant ?? { businessName: null, firstName: null, lastName: null })} · ${meter.meterCode}`,
      href: "/utilities/readings/new",
      sourceType: "UTILITY_METER",
      sourceId: meter.id,
    }));
}

async function buildSystemNotificationsForUser(user: Pick<AuthUser, "role">) {
  return user.role === "ADMIN"
    ? buildAdminNotifications()
    : buildMeterReaderNotifications();
}

function mapNotificationItems(
  rows: Array<{
    id: string;
    kind: NotificationSummary["items"][number]["kind"];
    severity: NotificationSummary["items"][number]["severity"];
    title: string;
    message: string;
    href: string | null;
    readAt: Date | null;
    createdAt: Date;
  }>
) {
  return rows.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    readAt: item.readAt ? item.readAt.toISOString() : null,
  }));
}

export async function syncNotificationsForUser(user: Pick<AuthUser, "id" | "role">) {
  const notifications = await buildSystemNotificationsForUser(user);
  const activeKeys = notifications.map((notification) => notification.dedupeKey);

  await Promise.all(
    notifications.map((notification) =>
      prisma.notification.upsert({
        where: {
          userId_dedupeKey: {
            userId: user.id,
            dedupeKey: notification.dedupeKey,
          },
        },
        update: {
          kind: notification.kind,
          severity: notification.severity,
          title: notification.title,
          message: notification.message,
          href: notification.href ?? null,
          sourceType: notification.sourceType ?? null,
          sourceId: notification.sourceId ?? null,
          expiresAt: notification.expiresAt ?? null,
        },
        create: {
          userId: user.id,
          kind: notification.kind,
          severity: notification.severity,
          dedupeKey: notification.dedupeKey,
          title: notification.title,
          message: notification.message,
          href: notification.href ?? null,
          sourceType: notification.sourceType ?? null,
          sourceId: notification.sourceId ?? null,
          expiresAt: notification.expiresAt ?? null,
        },
      })
    )
  );

  await prisma.notification.deleteMany({
    where: {
      userId: user.id,
      kind: {
        in: [...SYSTEM_NOTIFICATION_KINDS],
      },
      ...(activeKeys.length > 0
        ? {
            dedupeKey: {
              notIn: activeKeys,
            },
          }
        : {}),
    },
  });
}

function scheduleNotificationSync(user: Pick<AuthUser, "id" | "role">) {
  after(async () => {
    try {
      await syncNotificationsForUser(user);
    } catch (error) {
      console.error("Failed to sync notifications in the background.", error);
    }
  });
}

export async function getNotificationSummaryForUser(
  user: Pick<AuthUser, "id" | "role">
): Promise<NotificationSummary> {
  const [unreadCount, rows] = await Promise.all([
    prisma.notification.count({
      where: {
        userId: user.id,
        readAt: null,
      },
    }),
    prisma.notification.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      take: 5,
      select: {
        id: true,
        kind: true,
        severity: true,
        title: true,
        message: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);

  scheduleNotificationSync(user);

  return {
    unreadCount,
    items: mapNotificationItems(rows),
  };
}

export async function getNotificationInboxForUser(
  user: Pick<AuthUser, "id" | "role">
): Promise<NotificationInbox> {
  await syncNotificationsForUser(user);

  const [unreadCount, rows] = await Promise.all([
    prisma.notification.count({
      where: {
        userId: user.id,
        readAt: null,
      },
    }),
    prisma.notification.findMany({
      where: {
        userId: user.id,
      },
      orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        kind: true,
        severity: true,
        title: true,
        message: true,
        href: true,
        readAt: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    unreadCount,
    items: mapNotificationItems(rows),
  };
}
