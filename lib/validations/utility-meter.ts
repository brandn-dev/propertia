import { z } from "zod";
import { UTILITY_TYPES } from "@/lib/form-options";

export const utilityMeterSchema = z.object({
  propertyId: z.string().trim().min(1, "Property is required."),
  tenantId: z
    .string()
    .trim()
    .transform((value) => value || undefined),
  utilityType: z.enum(UTILITY_TYPES),
  meterCode: z
    .string()
    .trim()
    .min(2, "Meter code is required.")
    .max(40, "Meter code must be 40 characters or fewer.")
    .regex(
      /^[A-Za-z0-9-_/]+$/,
      "Meter code can only include letters, numbers, hyphens, underscores, and slashes."
    )
    .transform((value) => value.toUpperCase()),
  isShared: z.boolean(),
}).superRefine((value, ctx) => {
  if (!value.isShared && !value.tenantId) {
    ctx.addIssue({
      code: "custom",
      path: ["tenantId"],
      message: "Dedicated meters must be assigned to a tenant.",
    });
  }
});

export type UtilityMeterInput = z.infer<typeof utilityMeterSchema>;
