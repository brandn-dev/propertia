import "server-only";

import { prisma, withPrismaRetry } from "@/lib/prisma";

function buildTenantPeople(tenant: {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  contactNumber: string | null;
  email: string | null;
  address: string | null;
  validIdType: string | null;
  validIdNumber: string | null;
  tenantPeople: Array<{
    id: string;
    positionTitle: string | null;
    isPrimary: boolean;
    person: {
      id: string;
      firstName: string;
      lastName: string;
      middleName: string | null;
      contactNumber: string | null;
      email: string | null;
      address: string | null;
      validIdType: string | null;
      validIdNumber: string | null;
      notes: string | null;
    };
  }>;
  representatives: Array<{
    id: string;
    firstName: string;
    lastName: string;
    positionTitle: string | null;
    contactNumber: string | null;
    email: string | null;
    isPrimary: boolean;
  }>;
}) {
  if (tenant.tenantPeople.length > 0) {
    return tenant.tenantPeople.map((tenantPerson) => ({
      id: tenantPerson.id,
      personId: tenantPerson.person.id,
      firstName: tenantPerson.person.firstName,
      lastName: tenantPerson.person.lastName,
      middleName: tenantPerson.person.middleName,
      positionTitle: tenantPerson.positionTitle,
      contactNumber: tenantPerson.person.contactNumber,
      email: tenantPerson.person.email,
      address: tenantPerson.person.address,
      validIdType: tenantPerson.person.validIdType,
      validIdNumber: tenantPerson.person.validIdNumber,
      notes: tenantPerson.person.notes,
      isPrimary: tenantPerson.isPrimary,
    }));
  }

  if (tenant.representatives.length > 0) {
    return tenant.representatives.map((representative) => ({
      id: representative.id,
      personId: undefined,
      firstName: representative.firstName,
      lastName: representative.lastName,
      middleName: null,
      positionTitle: representative.positionTitle,
      contactNumber: representative.contactNumber,
      email: representative.email,
      address: tenant.address,
      validIdType: null,
      validIdNumber: null,
      notes: null,
      isPrimary: representative.isPrimary,
    }));
  }

  if (tenant.firstName || tenant.lastName) {
    return [
      {
        id: `legacy-${tenant.id}`,
        personId: undefined,
        firstName: tenant.firstName ?? "",
        lastName: tenant.lastName ?? "",
        middleName: null,
        positionTitle: tenant.type === "INDIVIDUAL" ? "Primary tenant" : null,
        contactNumber: tenant.contactNumber,
        email: tenant.email,
        address: tenant.address,
        validIdType: tenant.validIdType,
        validIdNumber: tenant.validIdNumber,
        notes: null,
        isPrimary: true,
      },
    ];
  }

  return [];
}

export async function getPropertyParentOptions(excludeId?: string) {
  return withPrismaRetry(() =>
    prisma.property.findMany({
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
    })
  );
}

export async function getInvoiceBrandingTemplateOptions() {
  return withPrismaRetry(() =>
    prisma.invoiceBrandingTemplate.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        brandName: true,
        isDefault: true,
      },
    })
  );
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
      contracts: {
        where: {
          status: {
            in: ["ACTIVE", "DRAFT"],
          },
        },
        orderBy: [{ status: "asc" }, { startDate: "desc" }],
        take: 1,
        select: {
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
        orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          readingDate: true,
          currentReading: true,
          invoiceItem: {
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
      currentReading: reading.currentReading.toString(),
      isBilled: Boolean(reading.invoiceItem),
    })),
  }));
}

export async function getMeterReadingForEdit(readingId: string) {
  const reading = await prisma.meterReading.findUnique({
    where: { id: readingId },
    select: {
      id: true,
      meterId: true,
      readingDate: true,
      previousReading: true,
      currentReading: true,
      ratePerUnit: true,
      totalAmount: true,
      consumption: true,
      invoiceItem: {
        select: {
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
            },
          },
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
            orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              readingDate: true,
              currentReading: true,
              invoiceItem: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!reading) {
    return null;
  }

  const hasLaterBilledReadings = reading.meter.readings.some(
    (entry) =>
      entry.id !== reading.id &&
      entry.readingDate > reading.readingDate &&
      Boolean(entry.invoiceItem)
  );

  return {
    ...reading,
    canEdit: !reading.invoiceItem && !hasLaterBilledReadings,
    hasLaterBilledReadings,
    meterOption: {
      id: reading.meter.id,
      meterCode: reading.meter.meterCode,
      utilityType: reading.meter.utilityType,
      isShared: reading.meter.isShared,
      property: reading.meter.property,
      tenant: reading.meter.tenant,
      readings: reading.meter.readings.map((entry) => ({
        id: entry.id,
        readingDate: entry.readingDate.toISOString(),
        currentReading: entry.currentReading.toString(),
        isBilled: Boolean(entry.invoiceItem),
      })),
    },
  };
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
      invoiceBrandingTemplateId: true,
      parentPropertyId: true,
      status: true,
      description: true,
      logoUrl: true,
      logoStorageKey: true,
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
  const tenant = await prisma.tenant.findUnique({
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
      tenantPeople: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          positionTitle: true,
          isPrimary: true,
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              middleName: true,
              contactNumber: true,
              email: true,
              address: true,
              validIdType: true,
              validIdNumber: true,
              notes: true,
            },
          },
        },
      },
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
          tenantPeople: true,
          representatives: true,
        },
      },
    },
  });

  if (!tenant) {
    return null;
  }

  return {
    ...tenant,
    people: buildTenantPeople(tenant),
  };
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
      securityDepositMonths: true,
      advanceRentMonths: true,
      freeRentCycles: true,
      advanceRentApplication: true,
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

export async function getContractRentAdjustmentOverview(contractId: string) {
  return prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      monthlyRent: true,
      paymentStartDate: true,
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
      rentAdjustments: {
        orderBy: [{ effectiveDate: "asc" }],
        select: {
          id: true,
          effectiveDate: true,
          increaseType: true,
          increaseValue: true,
          calculationType: true,
          basedOn: true,
          notes: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          invoices: true,
          rentAdjustments: true,
          recurringCharges: true,
        },
      },
    },
  });
}

export async function getRentAdjustmentForEdit(
  contractId: string,
  adjustmentId: string
) {
  return prisma.rentAdjustment.findFirst({
    where: {
      id: adjustmentId,
      contractId,
    },
    select: {
      id: true,
      contractId: true,
      effectiveDate: true,
      increaseType: true,
      increaseValue: true,
      calculationType: true,
      basedOn: true,
      notes: true,
      contract: {
        select: {
          id: true,
          monthlyRent: true,
          paymentStartDate: true,
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
  });
}

export async function getTenantProfile(tenantId: string) {
  const [
    tenant,
    invoiceMetrics,
    openInvoiceCount,
    paymentMetrics,
    readingMetrics,
    recentPayments,
    recentReadings,
  ] = await Promise.all([
    prisma.tenant.findUnique({
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
        createdAt: true,
        updatedAt: true,
        tenantPeople: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            id: true,
            positionTitle: true,
            isPrimary: true,
            person: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                middleName: true,
                contactNumber: true,
                email: true,
                address: true,
                validIdType: true,
                validIdNumber: true,
                notes: true,
              },
            },
          },
        },
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
        contracts: {
          orderBy: [{ startDate: "desc" }],
          select: {
            id: true,
            startDate: true,
            endDate: true,
            paymentStartDate: true,
            monthlyRent: true,
            status: true,
            property: {
              select: {
                name: true,
                propertyCode: true,
              },
            },
            _count: {
              select: {
                invoices: true,
                recurringCharges: true,
              },
            },
          },
        },
        invoices: {
          take: 12,
          orderBy: [{ issueDate: "desc" }, { createdAt: "desc" }],
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
                payments: true,
                items: true,
              },
            },
          },
        },
        utilityMeters: {
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            meterCode: true,
            utilityType: true,
            isShared: true,
            createdAt: true,
            property: {
              select: {
                name: true,
                propertyCode: true,
              },
            },
            readings: {
              take: 1,
              orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
              select: {
                readingDate: true,
                currentReading: true,
                totalAmount: true,
              },
            },
            _count: {
              select: {
                readings: true,
              },
            },
          },
        },
        _count: {
          select: {
            contracts: true,
            invoices: true,
            tenantPeople: true,
            representatives: true,
            utilityMeters: true,
            meterReadings: true,
          },
        },
      },
    }),
    prisma.invoice.aggregate({
      where: { tenantId },
      _sum: {
        totalAmount: true,
        balanceDue: true,
      },
    }),
    prisma.invoice.count({
      where: {
        tenantId,
        status: {
          in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"],
        },
      },
    }),
    prisma.payment.aggregate({
      where: {
        invoice: {
          tenantId,
        },
        status: "SETTLED",
      },
      _sum: {
        amountPaid: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.meterReading.aggregate({
      where: {
        tenantId,
      },
      _sum: {
        totalAmount: true,
        consumption: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.payment.findMany({
      where: {
        invoice: {
          tenantId,
        },
      },
      take: 12,
      orderBy: [{ paymentDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        amountPaid: true,
        paymentDate: true,
        dueDate: true,
        status: true,
        referenceNumber: true,
        createdAt: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
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
      },
    }),
    prisma.meterReading.findMany({
      where: {
        tenantId,
      },
      take: 12,
      orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        readingDate: true,
        consumption: true,
        totalAmount: true,
        createdAt: true,
        meter: {
          select: {
            meterCode: true,
            utilityType: true,
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
            invoice: {
              select: {
                id: true,
                invoiceNumber: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (!tenant) {
    return null;
  }

  return {
    ...tenant,
    people: buildTenantPeople(tenant),
    metrics: {
      openInvoiceCount,
      outstandingBalance: invoiceMetrics._sum.balanceDue,
      totalInvoiced: invoiceMetrics._sum.totalAmount,
      settledPaymentsCount: paymentMetrics._count._all,
      settledPaymentsTotal: paymentMetrics._sum.amountPaid,
      readingCount: readingMetrics._count._all,
      utilityChargesTotal: readingMetrics._sum.totalAmount,
      utilityConsumptionTotal: readingMetrics._sum.consumption,
    },
    recentPayments,
    recentReadings,
  };
}
