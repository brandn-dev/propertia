"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import { toDateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { contractSchema } from "@/lib/validations/contract";
import { rentAdjustmentSchema } from "@/lib/validations/rent-adjustment";
import { rentScheduleSchema } from "@/lib/validations/rent-schedule";

export type ContractFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type RentAdjustmentFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export type RentScheduleFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

function revalidateContractViews() {
  ["/dashboard", "/contracts", "/billing", "/properties", "/tenants"].forEach(
    (path) => revalidatePath(path)
  );
}

function getContractPayload(formData: FormData) {
  const startDate = String(formData.get("startDate") ?? "");
  const paymentStartDate = String(formData.get("paymentStartDate") ?? "").trim();

  return {
    propertyId: String(formData.get("propertyId") ?? ""),
    tenantId: String(formData.get("tenantId") ?? ""),
    startDate,
    endDate: String(formData.get("endDate") ?? ""),
    paymentStartDate: paymentStartDate || startDate,
    monthlyRent: String(formData.get("monthlyRent") ?? ""),
    advanceRentMonths: String(formData.get("advanceRentMonths") ?? "0"),
    securityDepositMonths: String(formData.get("securityDepositMonths") ?? "0"),
    freeRentCycles: String(formData.get("freeRentCycles") ?? "0"),
    advanceRentApplication: String(
      formData.get("advanceRentApplication") ?? "FIRST_BILLABLE_CYCLES"
    ),
    status: String(formData.get("status") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

function calculateContractTermAmounts(monthlyRent: string, months: string) {
  const monthlyRentValue = Number(monthlyRent || "0");
  const monthsValue = Number(months || "0");

  return Number((monthlyRentValue * monthsValue).toFixed(2)).toFixed(2);
}

function getRentAdjustmentPayload(formData: FormData) {
  return {
    effectiveDate: String(formData.get("effectiveDate") ?? ""),
    increaseType: String(formData.get("increaseType") ?? ""),
    increaseValue: String(formData.get("increaseValue") ?? ""),
    calculationType: String(formData.get("calculationType") ?? ""),
    basedOn: String(formData.get("basedOn") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

function getRentSchedulePayload(formData: FormData) {
  const rawValue = String(formData.get("scheduleRows") ?? "").trim();

  if (!rawValue) {
    return {
      rows: [],
      error: "Add at least one rent schedule row.",
    };
  }

  try {
    const parsed = JSON.parse(rawValue);

    return {
      rows: parsed,
      error: null,
    };
  } catch {
    return {
      rows: [],
      error: "Rent schedule could not be read. Try again.",
    };
  }
}

async function validateContractRelations(
  propertyId: string,
  tenantId: string,
  currentPropertyId?: string
) {
  const [property, tenant] = await Promise.all([
    prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        isLeasable: true,
        status: true,
      },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    }),
  ]);

  const errors: ContractFormState["errors"] = {};

  if (!property) {
    errors.propertyId = ["Select a valid property."];
  } else if (!property.isLeasable && property.id !== currentPropertyId) {
    errors.propertyId = ["Selected property is not marked as leasable."];
  } else if (property.status === "ARCHIVED" && property.id !== currentPropertyId) {
    errors.propertyId = ["Archived properties cannot receive new contracts."];
  }

  if (!tenant) {
    errors.tenantId = ["Select a valid tenant."];
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

async function validateRentAdjustmentContract(contractId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
    },
  });

  if (!contract) {
    return {
      contract: null,
      errors: {
        effectiveDate: ["Contract no longer exists."],
      },
    };
  }

  return {
    contract,
    errors: null,
  };
}

export async function createContractAction(
  _previousState: ContractFormState,
  formData: FormData
): Promise<ContractFormState> {
  await requireRole("ADMIN");

  const validatedFields = contractSchema.safeParse(getContractPayload(formData));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted contract fields and try again.",
    };
  }

  const relationErrors = await validateContractRelations(
    validatedFields.data.propertyId,
    validatedFields.data.tenantId
  );

  if (relationErrors) {
    return {
      errors: relationErrors,
      message: "Contract references are invalid.",
    };
  }

  try {
    await prisma.contract.create({
      data: {
        propertyId: validatedFields.data.propertyId,
        tenantId: validatedFields.data.tenantId,
        startDate: new Date(validatedFields.data.startDate),
        endDate: new Date(validatedFields.data.endDate),
        paymentStartDate: new Date(validatedFields.data.paymentStartDate),
        monthlyRent: validatedFields.data.monthlyRent,
        advanceRentMonths: Number(validatedFields.data.advanceRentMonths || "0"),
        securityDepositMonths: Number(
          validatedFields.data.securityDepositMonths || "0"
        ),
        freeRentCycles: Number(validatedFields.data.freeRentCycles || "0"),
        advanceRentApplication: validatedFields.data.advanceRentApplication,
        advanceRent: calculateContractTermAmounts(
          validatedFields.data.monthlyRent,
          validatedFields.data.advanceRentMonths
        ),
        securityDeposit: calculateContractTermAmounts(
          validatedFields.data.monthlyRent,
          validatedFields.data.securityDepositMonths
        ),
        status: validatedFields.data.status,
        notes: validatedFields.data.notes ?? null,
      },
    });
  } catch {
    return {
      message: "Contract could not be saved. Try again.",
    };
  }

  revalidateContractViews();
  redirect("/contracts");
}

export async function updateContractAction(
  contractId: string,
  _previousState: ContractFormState,
  formData: FormData
): Promise<ContractFormState> {
  await requireRole("ADMIN");

  const existingContract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { id: true, propertyId: true },
  });

  if (!existingContract) {
    return {
      message: "Contract no longer exists.",
    };
  }

  const validatedFields = contractSchema.safeParse(getContractPayload(formData));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted contract fields and try again.",
    };
  }

  const relationErrors = await validateContractRelations(
    validatedFields.data.propertyId,
    validatedFields.data.tenantId,
    existingContract.propertyId
  );

  if (relationErrors) {
    return {
      errors: relationErrors,
      message: "Contract references are invalid.",
    };
  }

  try {
    await prisma.contract.update({
      where: { id: contractId },
      data: {
        propertyId: validatedFields.data.propertyId,
        tenantId: validatedFields.data.tenantId,
        startDate: new Date(validatedFields.data.startDate),
        endDate: new Date(validatedFields.data.endDate),
        paymentStartDate: new Date(validatedFields.data.paymentStartDate),
        monthlyRent: validatedFields.data.monthlyRent,
        advanceRentMonths: Number(validatedFields.data.advanceRentMonths || "0"),
        securityDepositMonths: Number(
          validatedFields.data.securityDepositMonths || "0"
        ),
        freeRentCycles: Number(validatedFields.data.freeRentCycles || "0"),
        advanceRentApplication: validatedFields.data.advanceRentApplication,
        advanceRent: calculateContractTermAmounts(
          validatedFields.data.monthlyRent,
          validatedFields.data.advanceRentMonths
        ),
        securityDeposit: calculateContractTermAmounts(
          validatedFields.data.monthlyRent,
          validatedFields.data.securityDepositMonths
        ),
        status: validatedFields.data.status,
        notes: validatedFields.data.notes ?? null,
      },
    });
  } catch {
    return {
      message: "Contract could not be updated. Try again.",
    };
  }

  revalidateContractViews();
  redirect("/contracts");
}

export async function createRentAdjustmentAction(
  contractId: string,
  _previousState: RentAdjustmentFormState,
  formData: FormData
): Promise<RentAdjustmentFormState> {
  await requireRole("ADMIN");

  const validatedFields = rentAdjustmentSchema.safeParse(
    getRentAdjustmentPayload(formData)
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted rent adjustment fields and try again.",
    };
  }

  const relationResult = await validateRentAdjustmentContract(contractId);

  if (relationResult.errors || !relationResult.contract) {
    return {
      errors: relationResult.errors ?? undefined,
      message: "The parent contract is no longer available.",
    };
  }

  const effectiveDate = new Date(validatedFields.data.effectiveDate);

  if (effectiveDate < relationResult.contract.startDate) {
    return {
      errors: {
        effectiveDate: ["Effective date cannot be earlier than the contract start date."],
      },
      message: "Rent adjustment date is outside the contract term.",
    };
  }

  if (effectiveDate > relationResult.contract.endDate) {
    return {
      errors: {
        effectiveDate: ["Effective date must fall within the contract term."],
      },
      message: "Rent adjustment date is outside the contract term.",
    };
  }

  try {
    await prisma.rentAdjustment.create({
      data: {
        contractId,
        effectiveDate,
        increaseType: validatedFields.data.increaseType,
        increaseValue: validatedFields.data.increaseValue,
        calculationType: validatedFields.data.calculationType,
        basedOn: validatedFields.data.basedOn,
        notes: validatedFields.data.notes ?? null,
      },
    });
  } catch {
    return {
      message: "Rent adjustment could not be saved. Try again.",
    };
  }

  revalidateContractViews();
  revalidatePath(`/contracts/${contractId}/edit`);
  revalidatePath(`/contracts/${contractId}/adjustments`);
  redirect(`/contracts/${contractId}/adjustments`);
}

export async function saveRentScheduleAction(
  contractId: string,
  _previousState: RentScheduleFormState,
  formData: FormData
): Promise<RentScheduleFormState> {
  await requireRole("ADMIN");

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      startDate: true,
      endDate: true,
    },
  });

  if (!contract) {
    return {
      message: "Contract no longer exists.",
    };
  }

  const payload = getRentSchedulePayload(formData);

  if (payload.error) {
    return {
      errors: {
        scheduleRows: [payload.error],
      },
      message: "Rent schedule could not be saved.",
    };
  }

  const validatedFields = rentScheduleSchema.safeParse({
    rows: payload.rows,
  });

  if (!validatedFields.success) {
    return {
      errors: {
        scheduleRows: ["Fix the rent schedule rows and try again."],
      },
      message: "Fix the rent schedule and try again.",
    };
  }

  const rows = validatedFields.data.rows.map((row) => ({
    ...row,
    effectiveDate: new Date(row.effectiveDate),
    effectiveDateValue: row.effectiveDate,
  }));

  const contractStartValue = toDateInputValue(contract.startDate);

  if (rows[0]?.kind !== "BASE" || rows[0].effectiveDateValue !== contractStartValue) {
    return {
      errors: {
        scheduleRows: ["The first row must always match the contract start date."],
      },
      message: "Rent schedule start date is invalid.",
    };
  }

  if (rows.slice(1).some((row) => row.kind !== "ADJUSTMENT")) {
    return {
      errors: {
        scheduleRows: ["Only the first row can be the contract start rent."],
      },
      message: "Rent schedule rows are invalid.",
    };
  }

  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index].effectiveDate <= rows[index - 1].effectiveDate) {
      return {
        errors: {
          scheduleRows: ["Each new effectivity date must be later than the previous row."],
        },
        message: "Rent schedule dates are not in order.",
      };
    }
  }

  if (rows.some((row) => row.effectiveDate > contract.endDate)) {
    return {
      errors: {
        scheduleRows: ["Effectivity dates must stay within the contract term."],
      },
      message: "Rent schedule dates are outside the contract term.",
    };
  }

  const baseRow = rows[0];
  const adjustmentRows = rows.filter(
    (row): row is Extract<(typeof rows)[number], { kind: "ADJUSTMENT" }> =>
      row.kind === "ADJUSTMENT"
  );
  const scheduleAdjustments = adjustmentRows.map((row) => ({
    contractId,
    effectiveDate: row.effectiveDate,
    increaseType: row.increaseType,
    increaseValue: row.increaseValue,
    calculationType:
      row.basedOn === "BASE_RENT" ? ("SIMPLE" as const) : ("COMPOUND" as const),
    basedOn: row.basedOn,
    notes: `Scheduled rent starting ${row.effectiveDateValue}`,
  }));

  try {
    await prisma.$transaction([
      prisma.contract.update({
        where: { id: contractId },
        data: {
          monthlyRent: baseRow.monthlyRent,
        },
      }),
      prisma.rentAdjustment.deleteMany({
        where: { contractId },
      }),
      ...(scheduleAdjustments.length > 0
        ? [
            prisma.rentAdjustment.createMany({
              data: scheduleAdjustments,
            }),
          ]
        : []),
    ]);
  } catch {
    return {
      message: "Rent schedule could not be saved. Try again.",
    };
  }

  revalidateContractViews();
  revalidatePath(`/contracts/${contractId}/edit`);
  revalidatePath(`/contracts/${contractId}/adjustments`);
  redirect(`/contracts/${contractId}/adjustments`);
}

export async function updateRentAdjustmentAction(
  contractId: string,
  adjustmentId: string,
  _previousState: RentAdjustmentFormState,
  formData: FormData
): Promise<RentAdjustmentFormState> {
  await requireRole("ADMIN");

  const existingAdjustment = await prisma.rentAdjustment.findFirst({
    where: {
      id: adjustmentId,
      contractId,
    },
    select: {
      id: true,
      contractId: true,
    },
  });

  if (!existingAdjustment) {
    return {
      message: "Rent adjustment no longer exists.",
    };
  }

  const validatedFields = rentAdjustmentSchema.safeParse(
    getRentAdjustmentPayload(formData)
  );

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted rent adjustment fields and try again.",
    };
  }

  const relationResult = await validateRentAdjustmentContract(contractId);

  if (relationResult.errors || !relationResult.contract) {
    return {
      errors: relationResult.errors ?? undefined,
      message: "The parent contract is no longer available.",
    };
  }

  const effectiveDate = new Date(validatedFields.data.effectiveDate);

  if (effectiveDate < relationResult.contract.startDate) {
    return {
      errors: {
        effectiveDate: ["Effective date cannot be earlier than the contract start date."],
      },
      message: "Rent adjustment date is outside the contract term.",
    };
  }

  if (effectiveDate > relationResult.contract.endDate) {
    return {
      errors: {
        effectiveDate: ["Effective date must fall within the contract term."],
      },
      message: "Rent adjustment date is outside the contract term.",
    };
  }

  try {
    await prisma.rentAdjustment.update({
      where: { id: adjustmentId },
      data: {
        effectiveDate,
        increaseType: validatedFields.data.increaseType,
        increaseValue: validatedFields.data.increaseValue,
        calculationType: validatedFields.data.calculationType,
        basedOn: validatedFields.data.basedOn,
        notes: validatedFields.data.notes ?? null,
      },
    });
  } catch {
    return {
      message: "Rent adjustment could not be updated. Try again.",
    };
  }

  revalidateContractViews();
  revalidatePath(`/contracts/${contractId}/edit`);
  revalidatePath(`/contracts/${contractId}/adjustments`);
  redirect(`/contracts/${contractId}/adjustments`);
}
