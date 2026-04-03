import { z } from "zod";
import { TENANT_TYPES } from "@/lib/form-options";

export const tenantPersonSchema = z.object({
  personId: z
    .string()
    .trim()
    .max(64, "Person identifier is invalid.")
    .transform((value) => value || undefined),
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required.")
    .max(80, "First name must be 80 characters or fewer."),
  lastName: z
    .string()
    .trim()
    .min(1, "Last name is required.")
    .max(80, "Last name must be 80 characters or fewer."),
  middleName: z
    .string()
    .trim()
    .max(80, "Middle name must be 80 characters or fewer.")
    .transform((value) => value || undefined),
  positionTitle: z
    .string()
    .trim()
    .max(80, "Position or relation must be 80 characters or fewer.")
    .transform((value) => value || undefined),
  contactNumber: z
    .string()
    .trim()
    .max(32, "Contact number must be 32 characters or fewer.")
    .transform((value) => value || undefined),
  email: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || z.email().safeParse(value).success,
      "Enter a valid email address."
    ),
  address: z
    .string()
    .trim()
    .max(240, "Address must be 240 characters or fewer.")
    .transform((value) => value || undefined),
  validIdType: z
    .string()
    .trim()
    .max(80, "ID type must be 80 characters or fewer.")
    .transform((value) => value || undefined),
  validIdNumber: z
    .string()
    .trim()
    .max(80, "ID number must be 80 characters or fewer.")
    .transform((value) => value || undefined),
  notes: z
    .string()
    .trim()
    .max(240, "Notes must be 240 characters or fewer.")
    .transform((value) => value || undefined),
  isPrimary: z.boolean(),
});

export const tenantSchema = z
  .object({
    type: z.enum(TENANT_TYPES),
    businessName: z
      .string()
      .trim()
      .min(1, "Business name is required.")
      .max(120, "Business name must be 120 characters or fewer."),
    contactNumber: z
      .string()
      .trim()
      .max(32, "Contact number must be 32 characters or fewer.")
      .transform((value) => value || undefined),
    email: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .refine(
        (value) => !value || z.email().safeParse(value).success,
        "Enter a valid email address."
      ),
    address: z
      .string()
      .trim()
      .max(240, "Address must be 240 characters or fewer.")
      .transform((value) => value || undefined),
    validIdType: z
      .string()
      .trim()
      .max(80, "ID type must be 80 characters or fewer.")
      .transform((value) => value || undefined),
    validIdNumber: z
      .string()
      .trim()
      .max(80, "ID number must be 80 characters or fewer.")
      .transform((value) => value || undefined),
    people: z.array(tenantPersonSchema).max(20, "Add up to 20 people per tenant record."),
  })
  .superRefine((value, ctx) => {
    if (value.type === "INDIVIDUAL" && value.people.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["people"],
        message: "Add at least one person for an individual tenant.",
      });
    }

    const primaryPeople = value.people.filter((person) => person.isPrimary);

    if (primaryPeople.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["people"],
        message: "Only one person can be marked as primary.",
      });
    }

    if (value.people.length > 0 && primaryPeople.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["people"],
        message: "Mark one person as the primary contact.",
      });
    }
  });

export type TenantInput = z.infer<typeof tenantSchema>;
