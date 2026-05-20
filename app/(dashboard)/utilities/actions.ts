"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAnyCapability } from "@/lib/auth/user";
import { toDateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { withToast } from "@/lib/toast";
import { meterReadingSchema } from "@/lib/validations/meter-reading";
import {
  utilityMeterReplacementSchema,
  utilityMeterSchema,
} from "@/lib/validations/utility-meter";

export type UtilityMeterFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
  redirectTo?: string;
};

export type MeterReadingFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
  redirectTo?: string;
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
    openedAt: String(formData.get("openedAt") ?? ""),
  };
}

function getMeterReadingPayload(formData: FormData) {
  return {
    meterId: String(formData.get("meterId") ?? ""),
    readingDate: String(formData.get("readingDate") ?? ""),
    currentReading: String(formData.get("currentReading") ?? ""),
    ratePerUnit: String(formData.get("ratePerUnit") ?? ""),
    startingReadingOverride: String(
      formData.get("startingReadingOverride") ?? ""
    ),
  };
}

function getUtilityMeterReplacementPayload(formData: FormData) {
  return {
    openedAt: String(formData.get("openedAt") ?? ""),
    meterCode: String(formData.get("meterCode") ?? ""),
    openingReading: String(formData.get("openingReading") ?? ""),
  };
}

function toFixedDecimal(value: number) {
  return value.toFixed(2);
}

function getAppDateKey(value: Date | string) {
  return toDateInputValue(value);
}

function compareAppDates(left: Date | string, right: Date | string) {
  const leftKey = getAppDateKey(left);
  const rightKey = getAppDateKey(right);

  if (leftKey < rightKey) {
    return -1;
  }

  if (leftKey > rightKey) {
    return 1;
  }

  return 0;
}

type TimelineReading = {
  id: string;
  readingDate: Date;
  currentReading: { toString(): string };
  ratePerUnit: { toString(): string };
  invoiceItem: { id: string } | null;
};

function findPreviousReading(readings: TimelineReading[], readingDate: Date) {
  return (
    [...readings]
      .reverse()
      .find((reading) => compareAppDates(reading.readingDate, readingDate) < 0) ?? null
  );
}

function findNextReading(readings: TimelineReading[], readingDate: Date) {
  return (
    readings.find((reading) => compareAppDates(reading.readingDate, readingDate) > 0) ?? null
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
      status: true,
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

  if (tenant.status === "ARCHIVED" && tenant.id !== currentTenantId) {
    return {
      tenantId: ["Archived tenants cannot receive new meter assignments."],
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
  const user = await requireAnyCapability(["MANAGE_UTILITIES", "MANAGE_METERS"]);

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
        openedAt:
          user.role === "ADMIN" && validatedFields.data.openedAt
            ? new Date(validatedFields.data.openedAt)
            : undefined,
      },
    });
  } catch {
    return {
      message: "Meter could not be saved. Try again.",
    };
  }

  revalidateUtilityViews();
  return {
    redirectTo: "/utilities/meters",
  };
}

export async function updateUtilityMeterAction(
  meterId: string,
  _previousState: UtilityMeterFormState,
  formData: FormData
): Promise<UtilityMeterFormState> {
  const user = await requireAnyCapability(["MANAGE_UTILITIES", "MANAGE_METERS"]);

  const existingMeter = await prisma.utilityMeter.findUnique({
    where: { id: meterId },
    select: {
      id: true,
      propertyId: true,
      tenantId: true,
      openedAt: true,
      retiredAt: true,
      replacesMeter: {
        select: {
          retiredAt: true,
        },
      },
      readings: {
        take: 1,
        orderBy: [{ readingDate: "asc" }, { createdAt: "asc" }],
        select: {
          readingDate: true,
        },
      },
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

  const requestedOpenedAt = validatedFields.data.openedAt
    ? new Date(validatedFields.data.openedAt)
    : existingMeter.openedAt;
  const openedAtChanged =
    compareAppDates(requestedOpenedAt, existingMeter.openedAt) !== 0;

  if (openedAtChanged && user.role !== "ADMIN") {
    return {
      errors: {
        openedAt: ["Only administrators can change a meter activation date."],
      },
      message: "Meter activation date can only be changed by an administrator.",
    };
  }

  const firstReading = existingMeter.readings[0] ?? null;

  if (firstReading && compareAppDates(requestedOpenedAt, firstReading.readingDate) > 0) {
    return {
      errors: {
        openedAt: [
          "Activation date cannot be later than the first recorded reading on this meter.",
        ],
      },
      message: "Meter activation date breaks reading chronology.",
    };
  }

  if (
    existingMeter.retiredAt &&
    compareAppDates(requestedOpenedAt, existingMeter.retiredAt) > 0
  ) {
    return {
      errors: {
        openedAt: [
          "Activation date cannot be later than this meter's retirement date.",
        ],
      },
      message: "Meter activation date is outside this meter's active timeline.",
    };
  }

  if (
    existingMeter.replacesMeter?.retiredAt &&
    compareAppDates(requestedOpenedAt, existingMeter.replacesMeter.retiredAt) < 0
  ) {
    return {
      errors: {
        openedAt: [
          "Activation date cannot be earlier than the previous meter's retirement date.",
        ],
      },
      message: "Meter activation date conflicts with replacement chronology.",
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
        openedAt: requestedOpenedAt,
      },
    });
  } catch {
    return {
      message: "Meter could not be updated. Try again.",
    };
  }

  revalidateUtilityViews();
  return {
    redirectTo: "/utilities/meters",
  };
}

export async function replaceUtilityMeterAction(
  meterId: string,
  _previousState: UtilityMeterFormState,
  formData: FormData
): Promise<UtilityMeterFormState> {
  await requireAnyCapability(["MANAGE_UTILITIES", "MANAGE_METERS"]);

  const validatedFields = utilityMeterReplacementSchema.safeParse(
    getUtilityMeterReplacementPayload(formData)
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted replacement fields and try again.",
    };
  }

  const existingMeter = await prisma.utilityMeter.findUnique({
    where: { id: meterId },
    select: {
      id: true,
      propertyId: true,
      tenantId: true,
      utilityType: true,
      isShared: true,
      retiredAt: true,
      readings: {
        take: 1,
        orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
        select: {
          readingDate: true,
        },
      },
    },
  });

  if (!existingMeter) {
    return {
      message: "Meter no longer exists.",
    };
  }

  if (existingMeter.retiredAt) {
    return {
      message: "This meter has already been retired.",
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

  const openedAt = new Date(validatedFields.data.openedAt);
  const latestReading = existingMeter.readings[0] ?? null;

  if (latestReading && compareAppDates(openedAt, latestReading.readingDate) < 0) {
    return {
      errors: {
        openedAt: [
          "Replacement date cannot be earlier than the latest recorded reading on this meter.",
        ],
      },
      message: "Replacement chronology is invalid.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.utilityMeter.update({
        where: { id: meterId },
        data: {
          retiredAt: openedAt,
        },
      });

      await tx.utilityMeter.create({
        data: {
          propertyId: existingMeter.propertyId,
          tenantId: existingMeter.isShared ? null : existingMeter.tenantId,
          utilityType: existingMeter.utilityType,
          meterCode: validatedFields.data.meterCode,
          isShared: existingMeter.isShared,
          openedAt,
          openingReading: toFixedDecimal(Number(validatedFields.data.openingReading)),
          replacesMeterId: existingMeter.id,
        },
      });
    });
  } catch {
    return {
      message: "Replacement meter could not be saved. Try again.",
    };
  }

  revalidateUtilityViews();
  return {
    redirectTo: "/utilities/meters",
  };
}

export async function createMeterReadingAction(
  _previousState: MeterReadingFormState,
  formData: FormData
): Promise<MeterReadingFormState> {
  const user = await requireAnyCapability([
    "MANAGE_UTILITIES",
    "RECORD_READINGS",
  ]);

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
      openedAt: true,
      retiredAt: true,
      openingReading: true,
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

  if (compareAppDates(readingDate, meter.openedAt) < 0) {
    return {
      errors: {
        readingDate: [
          "Reading date cannot be earlier than this meter's activation date.",
        ],
      },
      message: "Reading date is outside this meter's active timeline.",
    };
  }

  if (meter.retiredAt && compareAppDates(readingDate, meter.retiredAt) > 0) {
    return {
      errors: {
        readingDate: [
          "Reading date cannot be later than this meter's retirement date.",
        ],
      },
      message: "This meter has already been retired.",
    };
  }

  if (latestReading && compareAppDates(readingDate, latestReading.readingDate) <= 0) {
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
    : Number(meter.openingReading.toString());
  const startingReadingOverride =
    validatedFields.data.startingReadingOverride &&
    validatedFields.data.startingReadingOverride !== ""
      ? Number(validatedFields.data.startingReadingOverride)
      : null;
  const resolvedPreviousReading =
    !latestReading && user.role === "ADMIN" && startingReadingOverride !== null
      ? startingReadingOverride
      : previousReading;
  const currentReading = Number(validatedFields.data.currentReading);

  if (currentReading < resolvedPreviousReading) {
    return {
      errors: {
        currentReading: [
          `Current reading must be at least ${resolvedPreviousReading.toFixed(2)}.`,
        ],
      },
      message: "Current reading cannot be lower than the previous reading.",
    };
  }

  if (latestReading && startingReadingOverride !== null) {
    return {
      errors: {
        startingReadingOverride: [
          "Starting reading override is only available on the first reading for this meter.",
        ],
      },
      message: "Starting reading override is not allowed for this meter anymore.",
    };
  }

  if (startingReadingOverride !== null && user.role !== "ADMIN") {
    return {
      errors: {
        startingReadingOverride: [
          "Only administrators can override the starting reading.",
        ],
      },
      message: "Starting reading override requires administrator access.",
    };
  }

  const ratePerUnit = Number(validatedFields.data.ratePerUnit);
  const consumption = currentReading - resolvedPreviousReading;
  const totalAmount = consumption * ratePerUnit;

  try {
    await prisma.$transaction(async (tx) => {
      if (!latestReading && user.role === "ADMIN" && startingReadingOverride !== null) {
        await tx.utilityMeter.update({
          where: { id: meter.id },
          data: {
            openingReading: toFixedDecimal(startingReadingOverride),
          },
        });
      }

      await tx.meterReading.create({
        data: {
          meterId: validatedFields.data.meterId,
          tenantId: meter.tenantId ?? null,
          readingDate,
          previousReading: toFixedDecimal(resolvedPreviousReading),
          currentReading: toFixedDecimal(currentReading),
          consumption: toFixedDecimal(consumption),
          ratePerUnit: toFixedDecimal(ratePerUnit),
          totalAmount: toFixedDecimal(totalAmount),
          recordedById: user.id,
        },
      });
    });
  } catch {
    return {
      message:
        "Reading could not be saved. Check for duplicate dates on the same meter and try again.",
    };
  }

  revalidateUtilityViews();
  return {
    redirectTo: "/utilities/readings",
  };
}

export async function updateMeterReadingAction(
  readingId: string,
  _previousState: MeterReadingFormState,
  formData: FormData
): Promise<MeterReadingFormState> {
  const user = await requireAnyCapability([
    "MANAGE_UTILITIES",
    "RECORD_READINGS",
  ]);

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
          openedAt: true,
          retiredAt: true,
          openingReading: true,
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

  if (compareAppDates(readingDate, existingReading.meter.openedAt) < 0) {
    return {
      errors: {
        readingDate: [
          "Reading date cannot be earlier than this meter's activation date.",
        ],
      },
      message: "Reading date is outside this meter's active timeline.",
    };
  }

  if (
    existingReading.meter.retiredAt &&
    compareAppDates(readingDate, existingReading.meter.retiredAt) > 0
  ) {
    return {
      errors: {
        readingDate: [
          "Reading date cannot be later than this meter's retirement date.",
        ],
      },
      message: "Reading date is outside this meter's active timeline.",
    };
  }

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
    (reading) => compareAppDates(reading.readingDate, readingDate) === 0
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
      compareAppDates(reading.readingDate, readingDate) > 0 &&
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
    : Number(existingReading.meter.openingReading.toString());

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
    (reading) => compareAppDates(reading.readingDate, readingDate) > 0
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
  return {
    redirectTo: "/utilities/readings",
  };
}

export async function deleteMeterReadingAction(readingId: string) {
  await requireAnyCapability(["MANAGE_UTILITIES", "RECORD_READINGS"]);

  const existingReading = await prisma.meterReading.findUnique({
    where: { id: readingId },
    select: {
      id: true,
      meterId: true,
      readingDate: true,
      invoiceItem: {
        select: {
          id: true,
        },
      },
      meter: {
        select: {
          meterCode: true,
          openingReading: true,
        },
      },
    },
  });

  if (!existingReading) {
    redirect(
      withToast("/utilities/readings", {
        intent: "error",
        title: "Reading missing",
        description: "Reading could not be found.",
      })
    );
  }

  if (existingReading.invoiceItem) {
    redirect(
      withToast("/utilities/readings", {
        intent: "error",
        title: "Delete blocked",
        description: "Billed readings cannot be deleted.",
      })
    );
  }

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

  const laterBilledReading = siblingReadings.find(
    (reading) =>
      reading.readingDate.getTime() > existingReading.readingDate.getTime() &&
      Boolean(reading.invoiceItem)
  );

  if (laterBilledReading) {
    redirect(
      withToast("/utilities/readings", {
        intent: "error",
        title: "Delete blocked",
        description:
          "This reading cannot be deleted because a later billed reading on the same meter depends on it.",
      })
    );
  }

  const previousReading = findPreviousReading(
    siblingReadings,
    existingReading.readingDate
  );
  const subsequentReadings = siblingReadings.filter(
    (reading) =>
      reading.readingDate.getTime() > existingReading.readingDate.getTime()
  );

  let runningPreviousValue = previousReading
    ? Number(previousReading.currentReading.toString())
    : Number(existingReading.meter.openingReading.toString());

  const subsequentUpdates = [];

  for (const reading of subsequentReadings) {
    const nextCurrentValue = Number(reading.currentReading.toString());

    if (nextCurrentValue < runningPreviousValue) {
      redirect(
        withToast("/utilities/readings", {
          intent: "error",
          title: "Delete blocked",
          description:
            "Deleting this reading would break a later reading's chronology.",
        })
      );
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
      prisma.meterReading.delete({
        where: { id: readingId },
      }),
      ...subsequentUpdates,
    ]);
  } catch {
    redirect(
      withToast("/utilities/readings", {
        intent: "error",
        title: "Delete failed",
        description: "Reading could not be deleted.",
      })
    );
  }

  revalidateUtilityViews();
  revalidatePath(`/utilities/readings/${readingId}/edit`);
  redirect(
    withToast("/utilities/readings", {
      intent: "success",
      title: "Reading deleted",
      description: `Deleted reading on ${existingReading.meter.meterCode}.`,
    })
  );
}
