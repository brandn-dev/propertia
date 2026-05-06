"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import {
  getPropertyLogoFileError,
  removePropertyLogoFile,
  storePropertyLogoFile,
} from "@/lib/properties/logo-storage";
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
    invoiceBrandingTemplateId: String(
      formData.get("invoiceBrandingTemplateId") ?? ""
    ),
    parentPropertyId: String(formData.get("parentPropertyId") ?? ""),
    status: String(formData.get("status") ?? ""),
    description: String(formData.get("description") ?? ""),
    removeLogo: formData.get("removeLogo") === "true",
  };
}

async function resolvePropertyLogoInput(
  formData: FormData,
  currentLogo?: {
    logoUrl: string | null;
    logoStorageKey: string | null;
  }
) {
  const logoFile = formData.get("logoFile");
  const removeLogo = formData.get("removeLogo") === "true";
  const nextLogoFile =
    logoFile instanceof File && logoFile.size > 0 ? logoFile : null;

  if (nextLogoFile) {
    const logoFileError = getPropertyLogoFileError(nextLogoFile);

    if (logoFileError) {
      return {
        error: logoFileError,
      };
    }

    const storedLogo = await storePropertyLogoFile(nextLogoFile);

    return {
      ...storedLogo,
      replacedStorageKey: currentLogo?.logoStorageKey ?? null,
    };
  }

  if (removeLogo) {
    return {
      logoUrl: null,
      logoStorageKey: null,
      replacedStorageKey: currentLogo?.logoStorageKey ?? null,
    };
  }

  return {
    logoUrl: currentLogo?.logoUrl ?? null,
    logoStorageKey: currentLogo?.logoStorageKey ?? null,
    replacedStorageKey: null,
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

  if (data.invoiceBrandingTemplateId) {
    const template = await prisma.invoiceBrandingTemplate.findUnique({
      where: { id: data.invoiceBrandingTemplateId },
      select: { id: true },
    });

    if (!template) {
      return {
        errors: {
          invoiceBrandingTemplateId: ["Select a valid invoice template."],
        },
        message: "Invoice template could not be found.",
      };
    }
  }

  const logoInput = await resolvePropertyLogoInput(formData);

  if ("error" in logoInput) {
    const logoError = logoInput.error ?? "Property logo is invalid.";

    return {
      errors: {
        logoFile: [logoError],
      },
      message: "Property logo could not be saved.",
    };
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
        invoiceBrandingTemplateId: data.invoiceBrandingTemplateId ?? null,
        parentPropertyId: data.parentPropertyId ?? null,
        status: data.status,
        description: data.description ?? null,
        logoUrl: logoInput.logoUrl,
        logoStorageKey: logoInput.logoStorageKey,
      },
    });
  } catch {
    if (logoInput.logoStorageKey) {
      await removePropertyLogoFile(logoInput.logoStorageKey);
    }

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
    select: { id: true, logoUrl: true, logoStorageKey: true },
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

  if (data.invoiceBrandingTemplateId) {
    const template = await prisma.invoiceBrandingTemplate.findUnique({
      where: { id: data.invoiceBrandingTemplateId },
      select: { id: true },
    });

    if (!template) {
      return {
        errors: {
          invoiceBrandingTemplateId: ["Select a valid invoice template."],
        },
        message: "Invoice template could not be found.",
      };
    }
  }

  const logoInput = await resolvePropertyLogoInput(formData, existingProperty);

  if ("error" in logoInput) {
    const logoError = logoInput.error ?? "Property logo is invalid.";

    return {
      errors: {
        logoFile: [logoError],
      },
      message: "Property logo could not be updated.",
    };
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
        invoiceBrandingTemplateId: data.invoiceBrandingTemplateId ?? null,
        parentPropertyId: data.parentPropertyId ?? null,
        status: data.status,
        description: data.description ?? null,
        logoUrl: logoInput.logoUrl,
        logoStorageKey: logoInput.logoStorageKey,
      },
    });
  } catch {
    if (
      logoInput.logoStorageKey &&
      logoInput.logoStorageKey !== existingProperty.logoStorageKey
    ) {
      await removePropertyLogoFile(logoInput.logoStorageKey);
    }

    return {
      message: "Property could not be updated. Try again.",
    };
  }

  if (logoInput.replacedStorageKey) {
    await removePropertyLogoFile(logoInput.replacedStorageKey);
  }

  revalidatePropertyViews();
  redirect("/properties");
}
