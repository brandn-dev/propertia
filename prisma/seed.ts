import {
  AdvanceRentApplication,
  ContractStatus,
  PropertyCategory,
  PropertyOwnershipType,
  PropertyStatus,
  TenantType,
  UserRole,
  UtilityType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function upsertUser({
  username,
  displayName,
  password,
  role,
}: {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
}) {
  const normalizedUsername = username.trim().toLowerCase();
  const credentials = await hashPassword(password);

  return prisma.user.upsert({
    where: { username: normalizedUsername },
    update: {
      displayName,
      role,
      isActive: true,
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
    },
    create: {
      username: normalizedUsername,
      displayName,
      role,
      isActive: true,
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
    },
  });
}

const SAMPLE_PORTFOLIOS = [
  {
    name: "Solterra",
    code: "SLT",
    location: "Tagbilaran City, Bohol",
    spaces: [
      {
        name: "1F - B1",
        code: "SLT-1F-B1",
        tenantName: "SHESH SPA",
        startDate: "2025-07-01",
        endDate: "2030-07-01",
        paymentStartDate: "2025-10-01",
        monthlyRent: "500000",
        rentSchedule: [
          { effectiveDate: "2026-01-01", monthlyRent: "510000" },
          { effectiveDate: "2027-01-01", monthlyRent: "525000" },
          { effectiveDate: "2028-01-01", monthlyRent: "550000" },
          { effectiveDate: "2028-07-01", monthlyRent: "570000" },
          { effectiveDate: "2029-07-01", monthlyRent: "600000" },
        ],
        size: "46.00",
      },
      {
        name: "1F - B2",
        code: "SLT-1F-B2",
        tenantName: "COCO MANGO",
        startDate: "2025-08-01",
        endDate: "2030-07-31",
        monthlyRent: "130000",
        rentSchedule: [
          { effectiveDate: "2026-01-01", monthlyRent: "150000" },
          { effectiveDate: "2027-01-01", monthlyRent: "160000" },
          { effectiveDate: "2028-01-01", monthlyRent: "170000" },
          { effectiveDate: "2029-01-01", monthlyRent: "180000" },
          { effectiveDate: "2030-01-01", monthlyRent: "190000" },
        ],
        size: "42.00",
      },
      {
        name: "1F - B3",
        code: "SLT-1F-B3",
        tenantName: "K RESTAURANT",
        startDate: "2025-07-01",
        endDate: "2030-07-01",
        monthlyRent: "306000",
        rentSchedule: [
          { effectiveDate: "2027-07-01", monthlyRent: "321000" },
          { effectiveDate: "2028-07-01", monthlyRent: "337000" },
          { effectiveDate: "2029-07-01", monthlyRent: "353500" },
        ],
        size: "55.00",
      },
    ],
  },
  {
    name: "Terravue",
    code: "TRV",
    location: "Tagbilaran City, Bohol",
    spaces: [
      {
        name: "1F - B1, B2",
        code: "TRV-1F-B1B2",
        tenantName: "THE SPA",
        startDate: "2024-07-01",
        endDate: "2029-07-01",
        monthlyRent: "192400",
        rentSchedule: [{ effectiveDate: "2025-07-01", monthlyRent: "236800" }],
        size: "78.00",
      },
      {
        name: "1F - B3",
        code: "TRV-1F-B3",
        tenantName: "COPE DE BOHOL",
        startDate: "2024-11-16",
        endDate: "2026-11-16",
        monthlyRent: "55000",
        size: "31.00",
      },
      {
        name: "1F - B4",
        code: "TRV-1F-B4",
        tenantName: "COCOBERRY",
        startDate: "2024-09-01",
        endDate: "2029-09-01",
        monthlyRent: "42750",
        rentSchedule: [
          { effectiveDate: "2026-09-01", monthlyRent: "50000" },
          { effectiveDate: "2028-09-01", monthlyRent: "60000" },
        ],
        size: "34.00",
      },
      {
        name: "2F - B1",
        code: "TRV-2F-B1",
        tenantName: "MOIZA SNACKS",
        startDate: "2024-11-16",
        endDate: "2028-11-16",
        monthlyRent: "136800",
        rentSchedule: [{ effectiveDate: "2026-11-16", monthlyRent: "143640" }],
        size: "29.00",
      },
      {
        name: "2F - B2",
        code: "TRV-2F-B2",
        tenantName: "COCO NAILS",
        startDate: "2024-11-16",
        endDate: "2029-11-16",
        monthlyRent: "73000",
        rentSchedule: [
          { effectiveDate: "2026-11-16", monthlyRent: "78000" },
          { effectiveDate: "2028-11-16", monthlyRent: "83000" },
        ],
        size: "30.00",
      },
    ],
  },
] as const;

async function seedSamplePortfolio() {
  const [propertyCount, tenantCount, contractCount] = await Promise.all([
    prisma.property.count(),
    prisma.tenant.count(),
    prisma.contract.count(),
  ]);

  if (propertyCount > 0 || tenantCount > 0 || contractCount > 0) {
    return;
  }

  for (const portfolio of SAMPLE_PORTFOLIOS) {
    const building = await prisma.property.create({
      data: {
        name: portfolio.name,
        propertyCode: portfolio.code,
        ownershipType: PropertyOwnershipType.OWNED,
        category: PropertyCategory.BUILDING,
        location: portfolio.location,
        isLeasable: false,
        status: PropertyStatus.ACTIVE,
        description: `${portfolio.name} seeded sample building.`,
      },
    });

    await prisma.utilityMeter.createMany({
      data: [
        {
          propertyId: building.id,
          utilityType: UtilityType.ELECTRICITY,
          meterCode: `${portfolio.code}-SHARED-ELECTRIC`,
          isShared: true,
        },
        {
          propertyId: building.id,
          utilityType: UtilityType.WATER,
          meterCode: `${portfolio.code}-SHARED-WATER`,
          isShared: true,
        },
      ],
    });

    for (const space of portfolio.spaces) {
      const tenantEmail = `${space.code.toLowerCase().replaceAll(/[^a-z0-9]/g, "")}@example.com`;
      const paymentStartDate =
        "paymentStartDate" in space ? space.paymentStartDate : space.startDate;
      const rentSchedule = "rentSchedule" in space ? space.rentSchedule : undefined;
      const childProperty = await prisma.property.create({
        data: {
          name: space.name,
          propertyCode: space.code,
          ownershipType: PropertyOwnershipType.OWNED,
          category: PropertyCategory.COMMERCIAL_SPACE,
          location: portfolio.location,
          size: space.size,
          isLeasable: true,
          parentPropertyId: building.id,
          status: PropertyStatus.ACTIVE,
          description: `${space.name} in ${portfolio.name}.`,
        },
      });

      const tenant = await prisma.tenant.create({
        data: {
          type: TenantType.BUSINESS,
          businessName: space.tenantName,
          contactNumber: "09123456789",
          email: tenantEmail,
          address: portfolio.location,
          tenantPeople: {
            create: [
              {
                isPrimary: true,
                positionTitle: "Primary contact",
                person: {
                  create: {
                    firstName: space.tenantName.split(" ")[0] ?? "Tenant",
                    lastName: "Contact",
                    contactNumber: "09123456789",
                    email: tenantEmail,
                    address: portfolio.location,
                  },
                },
              },
            ],
          },
        },
      });

      const monthlyRent = Number(space.monthlyRent);

      await prisma.contract.create({
        data: {
          propertyId: childProperty.id,
          tenantId: tenant.id,
          startDate: new Date(`${space.startDate}T00:00:00.000Z`),
          endDate: new Date(`${space.endDate}T00:00:00.000Z`),
          monthlyRent: space.monthlyRent,
          securityDepositMonths: 2,
          advanceRentMonths: 2,
          freeRentCycles: 0,
          advanceRentApplication: AdvanceRentApplication.FIRST_BILLABLE_CYCLES,
          advanceRent: String(monthlyRent * 2),
          securityDeposit: String(monthlyRent * 2),
          paymentStartDate: new Date(`${paymentStartDate}T00:00:00.000Z`),
          status: ContractStatus.ACTIVE,
          notes: `Seeded sample tenancy for ${portfolio.name}.`,
          rentAdjustments:
            rentSchedule
              ? {
                  create: rentSchedule.map((scheduleRow, index) => {
                    const previousRent =
                      index === 0
                        ? Number(space.monthlyRent)
                        : Number(rentSchedule[index - 1].monthlyRent);
                    const nextRent = Number(scheduleRow.monthlyRent);

                    return {
                      effectiveDate: new Date(
                        `${scheduleRow.effectiveDate}T00:00:00.000Z`
                      ),
                      increaseType: "FIXED",
                      increaseValue: String(nextRent - previousRent),
                      calculationType: "COMPOUND",
                      basedOn: "PREVIOUS_RENT",
                      notes: `Seeded rent schedule starting ${scheduleRow.effectiveDate}`,
                    };
                  }),
                }
              : undefined,
        },
      });
    }
  }
}

async function main() {
  await upsertUser({
    username: process.env.ADMIN_USERNAME ?? "admin",
    displayName: process.env.ADMIN_DISPLAY_NAME ?? "System Administrator",
    password: requireEnv("ADMIN_PASSWORD"),
    role: UserRole.ADMIN,
  });

  await upsertUser({
    username: process.env.METER_READER_USERNAME ?? "meter.reader",
    displayName: process.env.METER_READER_DISPLAY_NAME ?? "Utility Reader",
    password: requireEnv("METER_READER_PASSWORD"),
    role: UserRole.METER_READER,
  });

  await seedSamplePortfolio();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
