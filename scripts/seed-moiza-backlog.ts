import "dotenv/config";
import { randomInt } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  InvoiceOrigin,
  InvoiceStatus,
  MeterReadingOrigin,
  Prisma,
  PrismaClient,
  UserRole,
  UtilityType,
} from "@prisma/client";
import { buildInvoiceNumber } from "../lib/billing/invoice-number";

const TENANT_NAME = "MOIZA SNACKS";
const PROPERTY_CODE = "TRV-2F-B1";
const ACCESS_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ACCESS_CODE_LENGTH = 6;
const EPSILON = 0.001;

type UtilitySeed = {
  meterCode: string;
  utilityType: UtilityType;
  current: number;
  rate: number;
};

type BacklogMonthSeed = {
  month: string;
  rentAmount: number;
  utilities: [UtilitySeed, UtilitySeed];
};

const BACKLOG_MONTHS: BacklogMonthSeed[] = [
  {
    month: "2025-06",
    rentAmount: 136800,
    utilities: [
      {
        meterCode: "MZS-E",
        utilityType: UtilityType.ELECTRICITY,
        current: 7331,
        rate: 12.32,
      },
      {
        meterCode: "MZS-W",
        utilityType: UtilityType.WATER,
        current: 170,
        rate: 98,
      },
    ],
  },
  {
    month: "2025-07",
    rentAmount: 136800,
    utilities: [
      {
        meterCode: "MZS-E",
        utilityType: UtilityType.ELECTRICITY,
        current: 10081,
        rate: 12.32,
      },
      {
        meterCode: "MZS-W",
        utilityType: UtilityType.WATER,
        current: 189,
        rate: 98,
      },
    ],
  },
  {
    month: "2025-08",
    rentAmount: 136800,
    utilities: [
      {
        meterCode: "MZS-E",
        utilityType: UtilityType.ELECTRICITY,
        current: 13112,
        rate: 12.32,
      },
      {
        meterCode: "MZS-W",
        utilityType: UtilityType.WATER,
        current: 207,
        rate: 98,
      },
    ],
  },
  {
    month: "2025-09",
    rentAmount: 136800,
    utilities: [
      {
        meterCode: "MZS-E",
        utilityType: UtilityType.ELECTRICITY,
        current: 16232.8,
        rate: 12.32,
      },
      {
        meterCode: "MZS-W",
        utilityType: UtilityType.WATER,
        current: 230,
        rate: 98,
      },
    ],
  },
  {
    month: "2025-10",
    rentAmount: 136800,
    utilities: [
      {
        meterCode: "MZS-E",
        utilityType: UtilityType.ELECTRICITY,
        current: 19056.5,
        rate: 12.32,
      },
      {
        meterCode: "MZS-W",
        utilityType: UtilityType.WATER,
        current: 248,
        rate: 98,
      },
    ],
  },
  {
    month: "2025-11",
    rentAmount: 136800,
    utilities: [
      {
        meterCode: "MZS-E",
        utilityType: UtilityType.ELECTRICITY,
        current: 22022.2,
        rate: 12.32,
      },
      {
        meterCode: "MZS-W",
        utilityType: UtilityType.WATER,
        current: 274,
        rate: 98,
      },
    ],
  },
  {
    month: "2025-12",
    rentAmount: 136800,
    utilities: [
      {
        meterCode: "MZS-E",
        utilityType: UtilityType.ELECTRICITY,
        current: 24404,
        rate: 12.32,
      },
      {
        meterCode: "MZS-W",
        utilityType: UtilityType.WATER,
        current: 295,
        rate: 98,
      },
    ],
  },
  {
    month: "2026-01",
    rentAmount: 136800,
    utilities: [
      {
        meterCode: "MZS-E",
        utilityType: UtilityType.ELECTRICITY,
        current: 27203.9,
        rate: 12.32,
      },
      {
        meterCode: "MZS-W",
        utilityType: UtilityType.WATER,
        current: 323,
        rate: 98,
      },
    ],
  },
  {
    month: "2026-02",
    rentAmount: 136800,
    utilities: [
      {
        meterCode: "MZS-E",
        utilityType: UtilityType.ELECTRICITY,
        current: 29542.8,
        rate: 12.32,
      },
      {
        meterCode: "MZS-W",
        utilityType: UtilityType.WATER,
        current: 350,
        rate: 98,
      },
    ],
  },
  {
    month: "2026-03",
    rentAmount: 136800,
    utilities: [
      {
        meterCode: "MZS-E",
        utilityType: UtilityType.ELECTRICITY,
        current: 32119.4,
        rate: 12.32,
      },
      {
        meterCode: "MZS-W",
        utilityType: UtilityType.WATER,
        current: 382,
        rate: 98,
      },
    ],
  },
];

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;

  if (!value) {
    throw new Error("DATABASE_URL missing.");
  }

  return value;
}

function generateAccessCode() {
  let code = "";

  for (let index = 0; index < ACCESS_CODE_LENGTH; index += 1) {
    code += ACCESS_CODE_CHARSET[randomInt(ACCESS_CODE_CHARSET.length)];
  }

  return code;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(run: () => Promise<T>, retries = 6, delayMs = 500): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (retries <= 0) {
      throw error;
    }

    await sleep(delayMs);
    return withRetry(run, retries - 1, Math.min(delayMs * 2, 4000));
  }
}

function toMoney(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) <= EPSILON;
}

function parseMonth(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    throw new Error(`Invalid month ${month}. Expected YYYY-MM.`);
  }

  return {
    year: Number(match[1]),
    monthIndex: Number(match[2]) - 1,
  };
}

function startOfMonth(month: string) {
  const { year, monthIndex } = parseMonth(month);
  const value = new Date(year, monthIndex, 1);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfMonth(month: string) {
  const { year, monthIndex } = parseMonth(month);
  const value = new Date(year, monthIndex + 1, 0);
  value.setHours(23, 59, 59, 999);
  return value;
}

function endOfPreviousMonth(month: string) {
  const { year, monthIndex } = parseMonth(month);
  const value = new Date(year, monthIndex, 0);
  value.setHours(23, 59, 59, 999);
  return value;
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(month: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(startOfMonth(month));
}

function getSelectedMonths() {
  const monthArg = process.argv.find((arg) => arg.startsWith("--month="));

  if (!monthArg) {
    return BACKLOG_MONTHS;
  }

  const selectedMonth = monthArg.slice("--month=".length);
  const match = BACKLOG_MONTHS.find((row) => row.month === selectedMonth);

  if (!match) {
    throw new Error(`Month ${selectedMonth} not found in BACKLOG_MONTHS.`);
  }

  return [match];
}

async function ensureUtilityReading(params: {
  tx: Prisma.TransactionClient;
  meterId: string;
  meterCode: string;
  tenantId: string;
  recordedById: string | null;
  month: string;
  previous: number;
  current: number;
  rate: number;
}) {
  const {
    tx,
    meterId,
    meterCode,
    tenantId,
    recordedById,
    month,
    previous,
    current,
    rate,
  } = params;
  const expectedTotal = round2((current - previous) * rate);
  const preferredDates = [startOfMonth(month), endOfPreviousMonth(month)];
  const timeline = await tx.meterReading.findMany({
    where: {
      meterId,
    },
    orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      meterId: true,
      readingDate: true,
      previousReading: true,
      currentReading: true,
      ratePerUnit: true,
      totalAmount: true,
      invoiceItem: {
        select: {
          id: true,
        },
      },
    },
  });

  for (const preferredDate of preferredDates) {
    const existing = timeline.find(
      (reading) => toDateKey(reading.readingDate) === toDateKey(preferredDate)
    );

    if (!existing) {
      continue;
    }

    const existingPrevious = Number(existing.previousReading.toString());
    const existingCurrent = Number(existing.currentReading.toString());

    if (!nearlyEqual(existingCurrent, current) || !nearlyEqual(existingPrevious, previous)) {
      continue;
    }

    if (existing.invoiceItem?.id) {
      throw new Error(
        `${meterCode} reading on ${toDateKey(existing.readingDate)} already linked to another invoice item.`
      );
    }

    const existingRate = Number(existing.ratePerUnit.toString());
    const existingTotal = Number(existing.totalAmount.toString());

    if (!nearlyEqual(existingRate, rate) || !nearlyEqual(existingTotal, expectedTotal)) {
      return tx.meterReading.update({
        where: { id: existing.id },
        data: {
          consumption: toMoney(current - previous),
          ratePerUnit: toMoney(rate),
          totalAmount: toMoney(expectedTotal),
        },
      });
    }

    return existing;
  }

  const createDate = endOfPreviousMonth(month);
  const earlierReadings = timeline.filter(
    (reading) => reading.readingDate.getTime() < createDate.getTime()
  );
  const latestEarlierReading = earlierReadings[earlierReadings.length - 1];
  const expectedPrevious = latestEarlierReading
    ? Number(latestEarlierReading.currentReading.toString())
    : 0;

  if (!nearlyEqual(expectedPrevious, previous)) {
    throw new Error(
      `${meterCode} previous mismatch for ${month}. Expected ${expectedPrevious}, got ${previous}.`
    );
  }

  const laterReadings = timeline.filter(
    (reading) => reading.readingDate.getTime() > createDate.getTime()
  );
  let runningPrevious = current;

  for (const laterReading of laterReadings) {
    const laterCurrent = Number(laterReading.currentReading.toString());

    if (laterCurrent + EPSILON < runningPrevious) {
      throw new Error(
        `${meterCode} chronology break for ${month}. Later reading ${toDateKey(laterReading.readingDate)} is below ${runningPrevious}.`
      );
    }

    if (laterReading.invoiceItem?.id) {
      const laterPrevious = Number(laterReading.previousReading.toString());

      if (!nearlyEqual(laterPrevious, runningPrevious)) {
        throw new Error(
          `${meterCode} later billed reading ${toDateKey(laterReading.readingDate)} would need previous ${runningPrevious}.`
        );
      }
    } else {
      await tx.meterReading.update({
        where: { id: laterReading.id },
        data: {
          previousReading: toMoney(runningPrevious),
          consumption: toMoney(laterCurrent - runningPrevious),
          totalAmount: toMoney(round2((laterCurrent - runningPrevious) * Number(laterReading.ratePerUnit.toString()))),
        },
      });
    }

    runningPrevious = laterCurrent;
  }

  return tx.meterReading.create({
    data: {
      meterId,
      tenantId,
      readingDate: createDate,
      previousReading: toMoney(previous),
      currentReading: toMoney(current),
      consumption: toMoney(current - previous),
      ratePerUnit: toMoney(rate),
      totalAmount: toMoney(expectedTotal),
      origin: MeterReadingOrigin.BACKLOG,
      recordedById,
    },
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const selectedMonths = getSelectedMonths();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
    log: ["error"],
  });

  try {
    const [adminUser, contract, meters] = await withRetry(() =>
      Promise.all([
        prisma.user.findFirst({
          where: {
            role: UserRole.ADMIN,
            isActive: true,
          },
          select: {
            id: true,
          },
        }),
        prisma.contract.findFirst({
          where: {
            tenant: {
              businessName: TENANT_NAME,
            },
            property: {
              propertyCode: PROPERTY_CODE,
            },
          },
          select: {
            id: true,
            tenantId: true,
            property: {
              select: {
                id: true,
                name: true,
                propertyCode: true,
              },
            },
          },
        }),
        prisma.utilityMeter.findMany({
          where: {
            meterCode: {
              in: ["MZS-E", "MZS-W"],
            },
          },
          select: {
            id: true,
            meterCode: true,
            utilityType: true,
            tenantId: true,
            propertyId: true,
            isShared: true,
          },
        }),
      ])
    );

    if (!contract) {
      throw new Error(`Contract not found for ${TENANT_NAME} / ${PROPERTY_CODE}.`);
    }

    const meterMap = new Map(meters.map((meter) => [meter.meterCode, meter]));

    for (const monthSeed of selectedMonths) {
      const cycleStart = startOfMonth(monthSeed.month);
      const cycleEnd = endOfMonth(monthSeed.month);
      const issueDate = startOfMonth(monthSeed.month);
      const dueDate = addDays(issueDate, 7);
      const existingInvoice = await withRetry(() =>
        prisma.invoice.findUnique({
          where: {
            contractId_billingPeriodStart_billingPeriodEnd: {
              contractId: contract.id,
              billingPeriodStart: cycleStart,
              billingPeriodEnd: cycleEnd,
            },
          },
          select: {
            id: true,
            invoiceNumber: true,
          },
        })
      );

      if (existingInvoice) {
        console.log(
          `skip ${monthSeed.month} -> invoice exists ${existingInvoice.invoiceNumber}`
        );
        continue;
      }

      const monthIndex = BACKLOG_MONTHS.findIndex((row) => row.month === monthSeed.month);

      if (monthIndex < 0) {
        throw new Error(`Month config missing for ${monthSeed.month}.`);
      }

      const utilityPlans = monthSeed.utilities.map((utilitySeed) => {
        const meter = meterMap.get(utilitySeed.meterCode);

        if (!meter) {
          throw new Error(`Meter ${utilitySeed.meterCode} not found.`);
        }

        if (meter.propertyId !== contract.property.id || meter.tenantId !== contract.tenantId || meter.isShared) {
          throw new Error(`Meter ${utilitySeed.meterCode} not eligible for ${TENANT_NAME}.`);
        }

        const previousMonthSeed = BACKLOG_MONTHS[monthIndex - 1];
        const previousUtility = previousMonthSeed?.utilities.find(
          (row) => row.meterCode === utilitySeed.meterCode
        );

        return {
          meter,
          utilityType: utilitySeed.utilityType,
          previous: previousUtility?.current ?? 0,
          current: utilitySeed.current,
          rate: utilitySeed.rate,
        };
      });

      if (dryRun) {
        console.log(
          JSON.stringify(
            {
              month: monthSeed.month,
              invoiceTitle: `Invoice for ${formatMonthLabel(monthSeed.month)}`,
              rentAmount: monthSeed.rentAmount,
              utilityServiceMonth: formatMonthLabel(
                `${String(endOfPreviousMonth(monthSeed.month).getFullYear())}-${String(
                  endOfPreviousMonth(monthSeed.month).getMonth() + 1
                ).padStart(2, "0")}`
              ),
              utilities: utilityPlans.map((plan) => ({
                meterCode: plan.meter.meterCode,
                utilityType: plan.utilityType,
                previous: plan.previous,
                current: plan.current,
                rate: plan.rate,
              })),
            },
            null,
            2
          )
        );
        continue;
      }

      const createdInvoice = await withRetry(() =>
        prisma.$transaction(async (tx) => {
          const resolvedReadings = [];

          for (const plan of utilityPlans) {
            const reading = await ensureUtilityReading({
              tx,
              meterId: plan.meter.id,
              meterCode: plan.meter.meterCode,
              tenantId: contract.tenantId,
              recordedById: adminUser?.id ?? null,
              month: monthSeed.month,
              previous: plan.previous,
              current: plan.current,
              rate: plan.rate,
            });

            resolvedReadings.push({
              ...plan,
              readingId: reading.id,
              readingDate: reading.readingDate,
              totalAmount: Number(reading.totalAmount.toString()),
            });
          }

          const utilityTotal = resolvedReadings.reduce(
            (sum, reading) => sum + reading.totalAmount,
            0
          );
          const totalAmount = round2(monthSeed.rentAmount + utilityTotal);
          let invoice = null;

          for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
              invoice = await tx.invoice.create({
                data: {
                  invoiceNumber: buildInvoiceNumber(issueDate, contract.property.propertyCode),
                  contractId: contract.id,
                  tenantId: contract.tenantId,
                  publicAccessCode: generateAccessCode(),
                  issueDate,
                  dueDate,
                  billingPeriodStart: cycleStart,
                  billingPeriodEnd: cycleEnd,
                  subtotal: toMoney(monthSeed.rentAmount),
                  additionalCharges: toMoney(utilityTotal),
                  discount: toMoney(0),
                  totalAmount: toMoney(totalAmount),
                  balanceDue: toMoney(totalAmount),
                  origin: InvoiceOrigin.BACKLOG,
                  status: InvoiceStatus.ISSUED,
                  notes: [
                    "MOIZA backlog seed script.",
                    `Invoice month ${formatMonthLabel(monthSeed.month)}.`,
                    `Utility service month ${formatMonthLabel(
                      `${String(endOfPreviousMonth(monthSeed.month).getFullYear())}-${String(
                        endOfPreviousMonth(monthSeed.month).getMonth() + 1
                      ).padStart(2, "0")}`
                    )}.`,
                  ].join(" "),
                  items: {
                    create: [
                      {
                        itemType: "RENT",
                        description: `Historical rent · ${formatMonthLabel(monthSeed.month)} · ${contract.property.name}`,
                        quantity: toMoney(1),
                        unitPrice: toMoney(monthSeed.rentAmount),
                        amount: toMoney(monthSeed.rentAmount),
                      },
                      ...resolvedReadings.map((reading) => ({
                        itemType: "UTILITY_READING" as const,
                        description: `${reading.utilityType === UtilityType.ELECTRICITY ? "Electricity" : "Water"} reading · ${reading.meter.meterCode} · ${toDateKey(reading.readingDate)}`,
                        quantity: toMoney(reading.current - reading.previous),
                        unitPrice: toMoney(reading.rate),
                        amount: toMoney(reading.totalAmount),
                        meterReadingId: reading.readingId,
                      })),
                    ],
                  },
                },
                select: {
                  id: true,
                  invoiceNumber: true,
                },
              });
              break;
            } catch (error) {
              if (
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002" &&
                Array.isArray(error.meta?.target) &&
                error.meta.target.includes("invoiceNumber") &&
                attempt < 2
              ) {
                continue;
              }

              throw error;
            }
          }

          if (!invoice) {
            throw new Error(`Invoice create failed for ${monthSeed.month}.`);
          }

          return invoice;
        })
      );

      console.log(`created ${monthSeed.month} -> ${createdInvoice.invoiceNumber}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
