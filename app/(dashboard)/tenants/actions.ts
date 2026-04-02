"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { tenantSchema } from "@/lib/validations/tenant";

export type TenantFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

type ParsedTenantPayload = ReturnType<typeof getTenantPayload>;

function revalidateTenantViews() {
  ["/dashboard", "/tenants", "/contracts", "/billing"].forEach((path) =>
    revalidatePath(path)
  );
}

function parseRepresentatives(value: FormDataEntryValue | null) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return {
      representatives: [],
      error: null,
    };
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return {
        representatives: [],
        error: "Representative data is invalid.",
      };
    }

    return {
      representatives: parsed,
      error: null,
    };
  } catch {
    return {
      representatives: [],
      error: "Representative data is invalid.",
    };
  }
}

function getTenantPayload(formData: FormData) {
  const representativeResult = parseRepresentatives(formData.get("representatives"));

  return {
    type: String(formData.get("type") ?? ""),
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
    contactNumber: String(formData.get("contactNumber") ?? ""),
    email: String(formData.get("email") ?? ""),
    address: String(formData.get("address") ?? ""),
    validIdType: String(formData.get("validIdType") ?? ""),
    validIdNumber: String(formData.get("validIdNumber") ?? ""),
    representatives: representativeResult.representatives,
    representativesParseError: representativeResult.error,
  };
}

function getRepresentativeFieldError(
  payload: ParsedTenantPayload
): TenantFormState | null {
  if (!payload.representativesParseError) {
    return null;
  }

  return {
    errors: {
      representatives: [payload.representativesParseError],
    },
    message: "Representative entries could not be read. Try again.",
  };
}

export async function createTenantAction(
  _previousState: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  await requireRole("ADMIN");

  const payload = getTenantPayload(formData);
  const representativeParseError = getRepresentativeFieldError(payload);

  if (representativeParseError) {
    return representativeParseError;
  }

  const validatedFields = tenantSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted tenant fields and try again.",
    };
  }

  const { representatives, ...tenantData } = validatedFields.data;

  try {
    await prisma.tenant.create({
      data: {
        ...tenantData,
        representatives:
          representatives.length > 0
            ? {
                create: representatives,
              }
            : undefined,
      },
    });
  } catch {
    return {
      message: "Tenant could not be saved. Try again.",
    };
  }

  revalidateTenantViews();
  redirect("/tenants");
}

export async function updateTenantAction(
  tenantId: string,
  _previousState: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  await requireRole("ADMIN");

  const existingTenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });

  if (!existingTenant) {
    return {
      message: "Tenant no longer exists.",
    };
  }

  const payload = getTenantPayload(formData);
  const representativeParseError = getRepresentativeFieldError(payload);

  if (representativeParseError) {
    return representativeParseError;
  }

  const validatedFields = tenantSchema.safeParse(payload);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted tenant fields and try again.",
    };
  }

  const { representatives, ...tenantData } = validatedFields.data;

  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...tenantData,
        representatives: {
          deleteMany: {},
          ...(representatives.length > 0
            ? {
                create: representatives,
              }
            : {}),
        },
      },
    });
  } catch {
    return {
      message: "Tenant could not be updated. Try again.",
    };
  }

  revalidateTenantViews();
  redirect("/tenants");
}
