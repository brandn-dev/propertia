"use server";

import type { Prisma } from "@prisma/client";
import type { ZodError } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import { prisma } from "@/lib/prisma";
import { tenantSchema, type TenantInput } from "@/lib/validations/tenant";

export type TenantFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
  personErrors?: Array<Record<string, string[] | undefined> | undefined>;
};

type ParsedPerson = {
  personId?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  positionTitle?: string;
  contactNumber?: string;
  email?: string;
  address?: string;
  validIdType?: string;
  validIdNumber?: string;
  notes?: string;
  isPrimary?: boolean;
};

type ParsedTenantPayload = {
  type: string;
  businessName: string;
  contactNumber: string;
  email: string;
  address: string;
  validIdType: string;
  validIdNumber: string;
  people: ParsedPerson[];
  peopleParseError: string | null;
};

function revalidateTenantViews() {
  ["/dashboard", "/tenants", "/contracts", "/billing"].forEach((path) =>
    revalidatePath(path)
  );
}

function parsePeople(value: FormDataEntryValue | null) {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return {
      people: [],
      error: null,
    };
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return {
        people: [],
        error: "People data is invalid.",
      };
    }

    return {
      people: parsed,
      error: null,
    };
  } catch {
    return {
      people: [],
      error: "People data is invalid.",
    };
  }
}

function getTenantPayload(formData: FormData): ParsedTenantPayload {
  const peopleResult = parsePeople(formData.get("people"));

  return {
    type: String(formData.get("type") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
    contactNumber: String(formData.get("contactNumber") ?? ""),
    email: String(formData.get("email") ?? ""),
    address: String(formData.get("address") ?? ""),
    validIdType: String(formData.get("validIdType") ?? ""),
    validIdNumber: String(formData.get("validIdNumber") ?? ""),
    people: normalizePeoplePayload(peopleResult.people),
    peopleParseError: peopleResult.error,
  };
}

function isBlankValue(value: unknown) {
  return typeof value !== "string" || value.trim().length === 0;
}

function isEmptyPerson(person: ParsedPerson) {
  return (
    isBlankValue(person.firstName) &&
    isBlankValue(person.lastName) &&
    isBlankValue(person.middleName) &&
    isBlankValue(person.positionTitle) &&
    isBlankValue(person.contactNumber) &&
    isBlankValue(person.email) &&
    isBlankValue(person.address) &&
    isBlankValue(person.validIdType) &&
    isBlankValue(person.validIdNumber) &&
    isBlankValue(person.notes)
  );
}

function normalizePeoplePayload(people: ParsedTenantPayload["people"]) {
  const normalizedPeople = people.filter((person) => !isEmptyPerson(person));

  if (normalizedPeople.length === 0) {
    return normalizedPeople;
  }

  const primaryIndex = normalizedPeople.findIndex((person) => Boolean(person.isPrimary));

  return normalizedPeople.map((person, index) => ({
    ...person,
    isPrimary: primaryIndex === -1 ? index === 0 : index === primaryIndex,
  }));
}

function buildTenantFormErrors(error: ZodError) {
  const fieldErrors = error.flatten().fieldErrors;
  const personErrors: TenantFormState["personErrors"] = [];

  for (const issue of error.issues) {
    const [root, index, field] = issue.path;

    if (
      root !== "people" ||
      typeof index !== "number" ||
      typeof field !== "string"
    ) {
      continue;
    }

    const rowErrors = personErrors[index] ?? {};
    rowErrors[field] = [...(rowErrors[field] ?? []), issue.message];
    personErrors[index] = rowErrors;
  }

  return {
    errors: fieldErrors,
    personErrors,
    message: "Fix the highlighted tenant fields and try again.",
  };
}

function getPeopleFieldError(payload: ParsedTenantPayload): TenantFormState | null {
  if (!payload.peopleParseError) {
    return null;
  }

  return {
    errors: {
      people: [payload.peopleParseError],
    },
    message: "People entries could not be read. Try again.",
  };
}

async function upsertTenantPeople(
  tx: Prisma.TransactionClient,
  tenantId: string,
  people: TenantInput["people"]
) {
  const linkedPeople = [];

  for (const person of people) {
    const personData = {
      firstName: person.firstName,
      lastName: person.lastName,
      middleName: person.middleName,
      contactNumber: person.contactNumber,
      email: person.email,
      address: person.address,
      validIdType: person.validIdType,
      validIdNumber: person.validIdNumber,
      notes: person.notes,
    };

    const savedPerson = person.personId
      ? await tx.person.update({
          where: { id: person.personId },
          data: personData,
        })
      : await tx.person.create({
          data: personData,
        });

    linkedPeople.push({
      tenantId,
      personId: savedPerson.id,
      positionTitle: person.positionTitle,
      isPrimary: person.isPrimary,
    });
  }

  if (linkedPeople.length === 0) {
    return;
  }

  await tx.tenantPerson.createMany({
    data: linkedPeople,
  });
}

export async function createTenantAction(
  _previousState: TenantFormState,
  formData: FormData
): Promise<TenantFormState> {
  await requireRole("ADMIN");

  const payload = getTenantPayload(formData);
  const peopleParseError = getPeopleFieldError(payload);

  if (peopleParseError) {
    return peopleParseError;
  }

  const validatedFields = tenantSchema.safeParse(payload);

  if (!validatedFields.success) {
    return buildTenantFormErrors(validatedFields.error);
  }

  const { people, ...tenantData } = validatedFields.data;

  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          ...tenantData,
          firstName: null,
          lastName: null,
        },
      });

      await upsertTenantPeople(tx, tenant.id, people);
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
  const peopleParseError = getPeopleFieldError(payload);

  if (peopleParseError) {
    return peopleParseError;
  }

  const validatedFields = tenantSchema.safeParse(payload);

  if (!validatedFields.success) {
    return buildTenantFormErrors(validatedFields.error);
  }

  const { people, ...tenantData } = validatedFields.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          ...tenantData,
          firstName: null,
          lastName: null,
          representatives: {
            deleteMany: {},
          },
          tenantPeople: {
            deleteMany: {},
          },
        },
      });

      await upsertTenantPeople(tx, tenantId, people);
    });
  } catch {
    return {
      message: "Tenant could not be updated. Try again.",
    };
  }

  revalidateTenantViews();
  redirect("/tenants");
}
