"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { meterReadingSchema } from "@/lib/validations/meter-reading";
import { utilityMeterSchema } from "@/lib/validations/utility-meter";

export type UtilityMeterFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type MeterReadingFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

function revalidateUtilityViews() {
  [
    "/dashboard",
    "/utilities",
    "/utilities/meters",
    "/utilities/readings",
    "/properties",
    "/billing",
  ].forEach((path) => revalidatePath(path));
}

function getUtilityMeterPayload(formData: FormData) {
  return {
    propertyId: String(formData.get("propertyId") ?? ""),
    tenantId: String(formData.get("tenantId") ?? ""),
    utilityType: String(formData.get("utilityType") ?? ""),
    meterCode: String(formData.get("meterCode") ?? ""),
    isShared: formData.get("isShared") === "on",
  };
}

function getMeterReadingPayload(formData: FormData) {
  return {
    meterId: String(formData.get("meterId") ?? ""),
    readingDate: String(formData.get("readingDate") ?? ""),
    currentReading: String(formData.get("currentReading") ?? ""),
    ratePerUnit: String(formData.get("ratePerUnit") ?? ""),
  };
}

function toFixedDecimal(value: number) {
  return value.toFixed(2);
}

type TimelineReading = {
  id: string;
  readingDate: Date;
  currentReading: { toString(): string };
  ratePerUnit: { toString(): string };
  invoiceItem: { id: string } | null;
};

function findPreviousReading(readings: TimelineReading[], readingDate: Date) {
  const timestamp = readingDate.getTime();

  return (
    [...readings]
      .reverse()
      .find((reading) => reading.readingDate.getTime() < timestamp) ?? null
  );
}

function findNextReading(readings: TimelineReading[], readingDate: Date) {
  const timestamp = readingDate.getTime();

  return (
    readings.find((reading) => reading.readingDate.getTime() > timestamp) ?? null
  );
}

async function validateUtilityProperty(propertyId: string, currentPropertyId?: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!property) {
    return {
      propertyId: ["Select a valid property."],
    };
  }

  if (property.status === "ARCHIVED" && property.id !== currentPropertyId) {
    return {
      propertyId: ["Archived properties cannot receive new utility meters."],
    };
  }

  return null;
}

async function validateUtilityTenant(
  propertyId: string,
  tenantId: string | undefined,
  currentTenantId?: string,
  currentPropertyId?: string
) {
  if (!tenantId) {
    return null;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      contracts: {
        where: {
          propertyId,
          status: {
            in: ["DRAFT", "ACTIVE"],
          },
        },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!tenant) {
    return {
      tenantId: ["Select a valid tenant."],
    };
  }

  const hasEligibleContract = tenant.contracts.length > 0;
  const canKeepCurrentAssignment =
    tenant.id === currentTenantId && propertyId === currentPropertyId;

  if (!hasEligibleContract && !canKeepCurrentAssignment) {
    return {
      tenantId: [
        "Assigned tenant must have a draft or active contract on the selected property.",
      ],
    };
  }

  return null;
}

async function utilityMeterCodeExists(meterCode: string, meterId?: string) {
  const existing = await prisma.utilityMeter.findFirst({
    where: {
      meterCode,
      ...(meterId ? { id: { not: meterId } } : {}),
    },
    select: { id: true },
  });

  return Boolean(existing);
}

export async function createUtilityMeterAction(
  _previousState: UtilityMeterFormState,
  formData: FormData
): Promise<UtilityMeterFormState> {
  await requireRole("ADMIN");

  const validatedFields = utilityMeterSchema.safeParse(
    getUtilityMeterPayload(formData)
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted meter fields and try again.",
    };
  }

  const propertyErrors = await validateUtilityProperty(
    validatedFields.data.propertyId
  );

  if (propertyErrors) {
    return {
      errors: propertyErrors,
      message: "Meter property selection is invalid.",
    };
  }

  const tenantErrors = validatedFields.data.isShared
    ? null
    : await validateUtilityTenant(
        validatedFields.data.propertyId,
        validatedFields.data.tenantId
      );

  if (tenantErrors) {
    return {
      errors: tenantErrors,
      message: "Meter tenant assignment is invalid.",
    };
  }

  if (await utilityMeterCodeExists(validatedFields.data.meterCode)) {
    return {
      errors: {
        meterCode: ["That meter code is already in use."],
      },
      message: "Meter code must be unique.",
    };
  }

  try {
    await prisma.utilityMeter.create({
      data: {
        propertyId: validatedFields.data.propertyId,
        tenantId: validatedFields.data.isShared
          ? null
          : validatedFields.data.tenantId ?? null,
        utilityType: validatedFields.data.utilityType,
        meterCode: validatedFields.data.meterCode,
        isShared: validatedFields.data.isShared,
      },
    });
  } catch {
    return {
      message: "Meter could not be saved. Try again.",
    };
  }

  revalidateUtilityViews();
  redirect("/utilities/meters");
}

export async function updateUtilityMeterAction(
  meterId: string,
  _previousState: UtilityMeterFormState,
  formData: FormData
): Promise<UtilityMeterFormState> {
  await requireRole("ADMIN");

  const existingMeter = await prisma.utilityMeter.findUnique({
    where: { id: meterId },
    select: {
      id: true,
      propertyId: true,
      tenantId: true,
    },
  });

  if (!existingMeter) {
    return {
      message: "Meter no longer exists.",
    };
  }

  const validatedFields = utilityMeterSchema.safeParse(
    getUtilityMeterPayload(formData)
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted meter fields and try again.",
    };
  }

  const propertyErrors = await validateUtilityProperty(
    validatedFields.data.propertyId,
    existingMeter.propertyId
  );

  if (propertyErrors) {
    return {
      errors: propertyErrors,
      message: "Meter property selection is invalid.",
    };
  }

  const tenantErrors = validatedFields.data.isShared
    ? null
    : await validateUtilityTenant(
        validatedFields.data.propertyId,
        validatedFields.data.tenantId,
        existingMeter.tenantId ?? undefined,
        existingMeter.propertyId
      );

  if (tenantErrors) {
    return {
      errors: tenantErrors,
      message: "Meter tenant assignment is invalid.",
    };
  }

  if (await utilityMeterCodeExists(validatedFields.data.meterCode, meterId)) {
    return {
      errors: {
        meterCode: ["That meter code is already in use."],
      },
      message: "Meter code must be unique.",
    };
  }

  try {
    await prisma.utilityMeter.update({
      where: { id: meterId },
      data: {
        propertyId: validatedFields.data.propertyId,
        tenantId: validatedFields.data.isShared
          ? null
          : validatedFields.data.tenantId ?? null,
        utilityType: validatedFields.data.utilityType,
        meterCode: validatedFields.data.meterCode,
        isShared: validatedFields.data.isShared,
      },
    });
  } catch {
    return {
      message: "Meter could not be updated. Try again.",
    };
  }

  revalidateUtilityViews();
  redirect("/utilities/meters");
}

export async function createMeterReadingAction(
  _previousState: MeterReadingFormState,
  formData: FormData
): Promise<MeterReadingFormState> {
  const user = await requireRole(["ADMIN", "METER_READER"]);

  const validatedFields = meterReadingSchema.safeParse(
    getMeterReadingPayload(formData)
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted reading fields and try again.",
    };
  }

  const meter = await prisma.utilityMeter.findUnique({
    where: { id: validatedFields.data.meterId },
    select: {
      id: true,
      tenantId: true,
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

  if (!meter) {
    return {
      errors: {
        meterId: ["Select a valid meter."],
      },
      message: "Meter selection is invalid.",
    };
  }

  const latestReading = meter.readings[0] ?? null;
  const readingDate = new Date(validatedFields.data.readingDate);

  if (latestReading && readingDate <= latestReading.readingDate) {
    return {
      errors: {
        readingDate: [
          "Reading date must be later than the latest recorded reading for this meter.",
        ],
      },
      message: "Readings are append-only and must move forward in time.",
    };
  }

  const previousReading = latestReading
    ? Number(latestReading.currentReading.toString())
    : 0;
  const currentReading = Number(validatedFields.data.currentReading);

  if (currentReading < previousReading) {
    return {
      errors: {
        currentReading: [
          `Current reading must be at least ${previousReading.toFixed(2)}.`,
        ],
      },
      message: "Current reading cannot be lower than the previous reading.",
    };
  }

  const ratePerUnit = Number(validatedFields.data.ratePerUnit);
  const consumption = currentReading - previousReading;
  const totalAmount = consumption * ratePerUnit;

  try {
    await prisma.meterReading.create({
      data: {
        meterId: validatedFields.data.meterId,
        tenantId: meter.tenantId ?? null,
        readingDate,
        previousReading: toFixedDecimal(previousReading),
        currentReading: toFixedDecimal(currentReading),
        consumption: toFixedDecimal(consumption),
        ratePerUnit: toFixedDecimal(ratePerUnit),
        totalAmount: toFixedDecimal(totalAmount),
        recordedById: user.id,
      },
    });
  } catch {
    return {
      message:
        "Reading could not be saved. Check for duplicate dates on the same meter and try again.",
    };
  }

  revalidateUtilityViews();
  redirect("/utilities/readings");
}

export async function updateMeterReadingAction(
  readingId: string,
  _previousState: MeterReadingFormState,
  formData: FormData
): Promise<MeterReadingFormState> {
  const user = await requireRole(["ADMIN", "METER_READER"]);

  const validatedFields = meterReadingSchema.safeParse(
    getMeterReadingPayload(formData)
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted reading fields and try again.",
    };
  }

  const existingReading = await prisma.meterReading.findUnique({
    where: { id: readingId },
    select: {
      id: true,
      meterId: true,
      invoiceItem: {
        select: {
          id: true,
        },
      },
      meter: {
        select: {
          tenantId: true,
        },
      },
    },
  });

  if (!existingReading) {
    return {
      message: "Reading no longer exists.",
    };
  }

  if (validatedFields.data.meterId !== existingReading.meterId) {
    return {
      errors: {
        meterId: ["This reading must stay on its original meter."],
      },
      message: "Meter selection is invalid for this edit.",
    };
  }

  if (existingReading.invoiceItem) {
    return {
      message: "Billed readings cannot be edited.",
    };
  }

  const readingDate = new Date(validatedFields.data.readingDate);
  const currentReading = Number(validatedFields.data.currentReading);
  const ratePerUnit = Number(validatedFields.data.ratePerUnit);

  const siblingReadings = await prisma.meterReading.findMany({
    where: {
      meterId: existingReading.meterId,
      id: {
        not: readingId,
      },
    },
    orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      readingDate: true,
      currentReading: true,
      ratePerUnit: true,
      invoiceItem: {
        select: {
          id: true,
        },
      },
    },
  });

  const conflictingReading = siblingReadings.find(
    (reading) => reading.readingDate.getTime() === readingDate.getTime()
  );

  if (conflictingReading) {
    return {
      errors: {
        readingDate: ["Another reading already exists on this meter for that date."],
      },
      message: "Reading date must stay unique per meter.",
    };
  }

  const laterBilledReading = siblingReadings.find(
    (reading) =>
      reading.readingDate.getTime() > readingDate.getTime() &&
      Boolean(reading.invoiceItem)
  );

  if (laterBilledReading) {
    return {
      message:
        "This reading cannot be edited because a later reading on the same meter has already been billed.",
    };
  }

  const previousReading = findPreviousReading(siblingReadings, readingDate);
  const nextReading = findNextReading(siblingReadings, readingDate);
  const previousReadingValue = previousReading
    ? Number(previousReading.currentReading.toString())
    : 0;

  if (currentReading < previousReadingValue) {
    return {
      errors: {
        currentReading: [
          `Current reading must be at least ${previousReadingValue.toFixed(2)}.`,
        ],
      },
      message: "Current reading cannot be lower than the previous reading.",
    };
  }

  if (
    nextReading &&
    currentReading > Number(nextReading.currentReading.toString())
  ) {
    return {
      errors: {
        currentReading: [
          `Current reading cannot exceed ${Number(nextReading.currentReading.toString()).toFixed(2)}, which is already recorded on ${nextReading.readingDate.toISOString().slice(0, 10)}.`,
        ],
      },
      message:
        "Current reading cannot be higher than the next recorded reading on the same meter.",
    };
  }

  const currentConsumption = currentReading - previousReadingValue;
  const currentTotalAmount = currentConsumption * ratePerUnit;

  const subsequentReadings = siblingReadings.filter(
    (reading) => reading.readingDate.getTime() > readingDate.getTime()
  );

  let runningPreviousValue = currentReading;
  const subsequentUpdates = [];

  for (const reading of subsequentReadings) {
    const nextCurrentValue = Number(reading.currentReading.toString());

    if (nextCurrentValue < runningPreviousValue) {
      return {
        message:
          "This edit would make a later reading invalid. Adjust the later reading first, then try again.",
      };
    }

    const nextConsumption = nextCurrentValue - runningPreviousValue;
    const nextRatePerUnit = Number(reading.ratePerUnit.toString());

    subsequentUpdates.push(
      prisma.meterReading.update({
        where: { id: reading.id },
        data: {
          previousReading: toFixedDecimal(runningPreviousValue),
          consumption: toFixedDecimal(nextConsumption),
          totalAmount: toFixedDecimal(nextConsumption * nextRatePerUnit),
        },
      })
    );

    runningPreviousValue = nextCurrentValue;
  }

  try {
    await prisma.$transaction([
      prisma.meterReading.update({
        where: { id: readingId },
        data: {
          readingDate,
          previousReading: toFixedDecimal(previousReadingValue),
          currentReading: toFixedDecimal(currentReading),
          consumption: toFixedDecimal(currentConsumption),
          ratePerUnit: toFixedDecimal(ratePerUnit),
          totalAmount: toFixedDecimal(currentTotalAmount),
          tenantId: existingReading.meter.tenantId ?? null,
          recordedById: user.id,
        },
      }),
      ...subsequentUpdates,
    ]);
  } catch {
    return {
      message:
        "Reading could not be updated. Check the meter chronology and try again.",
    };
  }

  revalidateUtilityViews();
  redirect("/utilities/readings");
}
