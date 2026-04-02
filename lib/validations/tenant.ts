import { z } from "zod";
import { TENANT_TYPES } from "@/lib/form-options";

export const tenantRepresentativeSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "Representative first name is required.")
    .max(80, "Representative first name must be 80 characters or fewer."),
  lastName: z
    .string()
    .trim()
    .min(1, "Representative last name is required.")
    .max(80, "Representative last name must be 80 characters or fewer."),
  positionTitle: z
    .string()
    .trim()
    .max(80, "Position title must be 80 characters or fewer.")
    .transform((value) => value || undefined),
  contactNumber: z
    .string()
    .trim()
    .max(32, "Representative contact number must be 32 characters or fewer.")
    .transform((value) => value || undefined),
  email: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || z.email().safeParse(value).success,
      "Enter a valid representative email address."
    ),
  isPrimary: z.boolean(),
});

export const tenantSchema = z
  .object({
    type: z.enum(TENANT_TYPES),
    firstName: z
      .string()
      .trim()
      .max(80, "First name must be 80 characters or fewer.")
      .transform((value) => value || undefined),
    lastName: z
      .string()
      .trim()
      .max(80, "Last name must be 80 characters or fewer.")
      .transform((value) => value || undefined),
    businessName: z
      .string()
      .trim()
      .min(1, "Business name is required.")
      .max(120, "Business name must be 120 characters or fewer.")
      .transform((value) => value),
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
    representatives: z
      .array(tenantRepresentativeSchema)
      .max(12, "Add up to 12 representatives per tenant record."),
  })
  .superRefine((value, ctx) => {
    if (value.type === "INDIVIDUAL") {
      if (!value.firstName) {
        ctx.addIssue({
          code: "custom",
          path: ["firstName"],
          message: "First name is required for individual tenants.",
        });
      }

      if (!value.lastName) {
        ctx.addIssue({
          code: "custom",
          path: ["lastName"],
          message: "Last name is required for individual tenants.",
        });
      }
    }

    if (value.type !== "BUSINESS" && value.representatives.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["representatives"],
        message: "Only business tenants can have multiple representatives.",
      });
    }

    const primaryRepresentatives = value.representatives.filter(
      (representative) => representative.isPrimary
    );

    if (primaryRepresentatives.length > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["representatives"],
        message: "Only one representative can be marked as primary.",
      });
    }
  });

export type TenantInput = z.infer<typeof tenantSchema>;
