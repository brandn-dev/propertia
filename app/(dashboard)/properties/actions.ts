"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { propertySchema } from "@/lib/validations/property";

export type PropertyFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

function revalidatePropertyViews() {
  ["/dashboard", "/properties", "/contracts", "/billing", "/utilities"].forEach(
    (path) => revalidatePath(path)
  );
}

function getPropertyPayload(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    propertyCode: String(formData.get("propertyCode") ?? ""),
    ownershipType: String(formData.get("ownershipType") ?? ""),
    category: String(formData.get("category") ?? ""),
    location: String(formData.get("location") ?? ""),
    size: String(formData.get("size") ?? ""),
    isLeasable: formData.get("isLeasable") === "on",
    parentPropertyId: String(formData.get("parentPropertyId") ?? ""),
    status: String(formData.get("status") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}

async function propertyCodeExists(propertyCode: string, propertyId?: string) {
  const match = await prisma.property.findFirst({
    where: {
      propertyCode,
      ...(propertyId ? { id: { not: propertyId } } : {}),
    },
    select: { id: true },
  });

  return Boolean(match);
}

async function parentCreatesCycle(propertyId: string, parentPropertyId: string) {
  let currentId: string | null = parentPropertyId;

  while (currentId) {
    if (currentId === propertyId) {
      return true;
    }

    const current: { parentPropertyId: string | null } | null =
      await prisma.property.findUnique({
      where: { id: currentId },
      select: { parentPropertyId: true },
    });

    currentId = current?.parentPropertyId ?? null;
  }

  return false;
}

export async function createPropertyAction(
  _previousState: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  await requireRole("ADMIN");

  const validatedFields = propertySchema.safeParse(getPropertyPayload(formData));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted property fields and try again.",
    };
  }

  const data = validatedFields.data;

  if (await propertyCodeExists(data.propertyCode)) {
    return {
      errors: {
        propertyCode: ["That property code is already in use."],
      },
      message: "Property code must be unique.",
    };
  }

  if (data.parentPropertyId) {
    const parent = await prisma.property.findUnique({
      where: { id: data.parentPropertyId },
      select: { id: true },
    });

    if (!parent) {
      return {
        errors: {
          parentPropertyId: ["Select a valid parent property."],
        },
        message: "Parent property could not be found.",
      };
    }
  }

  try {
    await prisma.property.create({
      data: {
        name: data.name,
        propertyCode: data.propertyCode,
        ownershipType: data.ownershipType,
        category: data.category,
        location: data.location,
        size: data.size ?? null,
        isLeasable: data.isLeasable,
        parentPropertyId: data.parentPropertyId ?? null,
        status: data.status,
        description: data.description ?? null,
      },
    });
  } catch {
    return {
      message: "Property could not be saved. Try again.",
    };
  }

  revalidatePropertyViews();
  redirect("/properties");
}

export async function updatePropertyAction(
  propertyId: string,
  _previousState: PropertyFormState,
  formData: FormData
): Promise<PropertyFormState> {
  await requireRole("ADMIN");

  const existingProperty = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });

  if (!existingProperty) {
    return {
      message: "Property no longer exists.",
    };
  }

  const validatedFields = propertySchema.safeParse(getPropertyPayload(formData));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted property fields and try again.",
    };
  }

  const data = validatedFields.data;

  if (await propertyCodeExists(data.propertyCode, propertyId)) {
    return {
      errors: {
        propertyCode: ["That property code is already in use."],
      },
      message: "Property code must be unique.",
    };
  }

  if (data.parentPropertyId === propertyId) {
    return {
      errors: {
        parentPropertyId: ["A property cannot be its own parent."],
      },
      message: "Parent relationship is invalid.",
    };
  }

  if (data.parentPropertyId) {
    const parent = await prisma.property.findUnique({
      where: { id: data.parentPropertyId },
      select: { id: true },
    });

    if (!parent) {
      return {
        errors: {
          parentPropertyId: ["Select a valid parent property."],
        },
        message: "Parent property could not be found.",
      };
    }

    if (await parentCreatesCycle(propertyId, data.parentPropertyId)) {
      return {
        errors: {
          parentPropertyId: [
            "This parent selection would create a circular property hierarchy.",
          ],
        },
        message: "Parent relationship is invalid.",
      };
    }
  }

  try {
    await prisma.property.update({
      where: { id: propertyId },
      data: {
        name: data.name,
        propertyCode: data.propertyCode,
        ownershipType: data.ownershipType,
        category: data.category,
        location: data.location,
        size: data.size ?? null,
        isLeasable: data.isLeasable,
        parentPropertyId: data.parentPropertyId ?? null,
        status: data.status,
        description: data.description ?? null,
      },
    });
  } catch {
    return {
      message: "Property could not be updated. Try again.",
    };
  }

  revalidatePropertyViews();
  redirect("/properties");
}
