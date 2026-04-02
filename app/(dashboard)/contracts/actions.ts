"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { contractSchema } from "@/lib/validations/contract";

export type ContractFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

function revalidateContractViews() {
  ["/dashboard", "/contracts", "/billing", "/properties", "/tenants"].forEach(
    (path) => revalidatePath(path)
  );
}

function getContractPayload(formData: FormData) {
  return {
    propertyId: String(formData.get("propertyId") ?? ""),
    tenantId: String(formData.get("tenantId") ?? ""),
    startDate: String(formData.get("startDate") ?? ""),
    endDate: String(formData.get("endDate") ?? ""),
    paymentStartDate: String(formData.get("paymentStartDate") ?? ""),
    monthlyRent: String(formData.get("monthlyRent") ?? ""),
    advanceRent: String(formData.get("advanceRent") ?? "0"),
    securityDeposit: String(formData.get("securityDeposit") ?? "0"),
    status: String(formData.get("status") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
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
        advanceRent:
          validatedFields.data.advanceRent === ""
            ? "0"
            : validatedFields.data.advanceRent,
        securityDeposit:
          validatedFields.data.securityDeposit === ""
            ? "0"
            : validatedFields.data.securityDeposit,
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
        advanceRent:
          validatedFields.data.advanceRent === ""
            ? "0"
            : validatedFields.data.advanceRent,
        securityDeposit:
          validatedFields.data.securityDeposit === ""
            ? "0"
            : validatedFields.data.securityDeposit,
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
