import { z } from "zod";
import {
  PROPERTY_CATEGORIES,
  PROPERTY_OWNERSHIP_TYPES,
  PROPERTY_STATUSES,
} from "@/lib/form-options";

export const propertySchema = z.object({
  name: z.string().trim().min(1, "Property name is required.").max(120),
  propertyCode: z
    .string()
    .trim()
    .min(2, "Property code is required.")
    .max(32, "Property code must be 32 characters or fewer.")
    .regex(
      /^[A-Za-z0-9-_/]+$/,
      "Property code can only include letters, numbers, hyphens, underscores, and slashes."
    )
    .transform((value) => value.toUpperCase()),
  ownershipType: z.enum(PROPERTY_OWNERSHIP_TYPES),
  category: z.enum(PROPERTY_CATEGORIES),
  location: z.string().trim().min(1, "Location is required.").max(160),
  size: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || (!Number.isNaN(Number(value)) && Number(value) >= 0),
      "Size must be a valid non-negative number."
    )
    .transform((value) => (value === "" ? undefined : value)),
  isLeasable: z.boolean(),
  invoiceBrandingTemplateId: z
    .string()
    .trim()
    .transform((value) => value || undefined),
  parentPropertyId: z
    .string()
    .trim()
    .transform((value) => value || undefined),
  status: z.enum(PROPERTY_STATUSES),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1000 characters or fewer.")
    .transform((value) => value || undefined),
  removeLogo: z.boolean(),
});

export type PropertyInput = z.infer<typeof propertySchema>;
