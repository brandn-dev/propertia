import "server-only";

import { prisma } from "@/lib/prisma";

export async function getPropertyParentOptions(excludeId?: string) {
  return prisma.property.findMany({
    where: excludeId
      ? {
          id: { not: excludeId },
        }
      : undefined,
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      propertyCode: true,
    },
  });
}

export async function getContractPropertyOptions(includePropertyId?: string) {
  return prisma.property.findMany({
    where: includePropertyId
      ? {
          OR: [
            {
              isLeasable: true,
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
          isLeasable: true,
          status: {
            not: "ARCHIVED",
          },
        },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      name: true,
      propertyCode: true,
      status: true,
    },
  });
}

export async function getContractTenantOptions() {
  return prisma.tenant.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      firstName: true,
      lastName: true,
      businessName: true,
    },
  });
}

export async function getUtilityPropertyOptions(includePropertyId?: string) {
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
      status: true,
    },
  });
}

export async function getUtilityTenantOptions(
  includeTenantId?: string,
  includePropertyId?: string
) {
  const contracts = await prisma.contract.findMany({
    where:
      includeTenantId && includePropertyId
        ? {
            OR: [
              {
                status: {
                  in: ["DRAFT", "ACTIVE"],
                },
              },
              {
                tenantId: includeTenantId,
                propertyId: includePropertyId,
              },
            ],
          }
        : {
            status: {
              in: ["DRAFT", "ACTIVE"],
            },
          },
    orderBy: [{ startDate: "desc" }],
    select: {
      propertyId: true,
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
  });

  const tenants = new Map<
    string,
    {
      id: string;
      type: string;
      firstName: string | null;
      lastName: string | null;
      businessName: string | null;
      propertyIds: Set<string>;
    }
  >();

  for (const contract of contracts) {
    const existing = tenants.get(contract.tenant.id);

    if (existing) {
      existing.propertyIds.add(contract.propertyId);
      continue;
    }

    tenants.set(contract.tenant.id, {
      ...contract.tenant,
      propertyIds: new Set([contract.propertyId]),
    });
  }

  return [...tenants.values()]
    .map((tenant) => ({
      ...tenant,
      propertyIds: [...tenant.propertyIds],
    }))
    .sort((left, right) => {
      const leftName =
        left.businessName ||
        [left.firstName, left.lastName].filter(Boolean).join(" ") ||
        "Tenant";
      const rightName =
        right.businessName ||
        [right.firstName, right.lastName].filter(Boolean).join(" ") ||
        "Tenant";

      return leftName.localeCompare(rightName);
    });
}

export async function getUtilityMeterForEdit(meterId: string) {
  return prisma.utilityMeter.findUnique({
    where: { id: meterId },
    select: {
      id: true,
      propertyId: true,
      tenantId: true,
      utilityType: true,
      meterCode: true,
      isShared: true,
      property: {
        select: {
          name: true,
          propertyCode: true,
        },
      },
      tenant: {
        select: {
          id: true,
          type: true,
          firstName: true,
          lastName: true,
          businessName: true,
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

export async function getUtilityMeterReadingOptions() {
  const meters = await prisma.utilityMeter.findMany({
    orderBy: [{ createdAt: "desc" }],
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
      tenant: {
        select: {
          id: true,
          type: true,
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      readings: {
        take: 1,
        orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
        select: {
          readingDate: true,
          currentReading: true,
        },
      },
    },
  });

  return meters.map((meter) => ({
    ...meter,
    readings: meter.readings.map((reading) => ({
      readingDate: reading.readingDate.toISOString(),
      currentReading: reading.currentReading.toString(),
    })),
  }));
}

export async function getPropertyForEdit(propertyId: string) {
  return prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      name: true,
      propertyCode: true,
      ownershipType: true,
      category: true,
      location: true,
      size: true,
      isLeasable: true,
      parentPropertyId: true,
      status: true,
      description: true,
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

export async function getTenantForEdit(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      type: true,
      firstName: true,
      lastName: true,
      businessName: true,
      contactNumber: true,
      email: true,
      address: true,
      validIdType: true,
      validIdNumber: true,
      representatives: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          firstName: true,
          lastName: true,
          positionTitle: true,
          contactNumber: true,
          email: true,
          isPrimary: true,
        },
      },
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

export async function getContractForEdit(contractId: string) {
  return prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      propertyId: true,
      tenantId: true,
      startDate: true,
      endDate: true,
      monthlyRent: true,
      advanceRent: true,
      securityDeposit: true,
      paymentStartDate: true,
      status: true,
      notes: true,
      property: {
        select: {
          name: true,
          propertyCode: true,
        },
      },
      tenant: {
        select: {
          type: true,
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      _count: {
        select: {
          invoices: true,
          payments: true,
          rentAdjustments: true,
          recurringCharges: true,
        },
      },
    },
  });
}
