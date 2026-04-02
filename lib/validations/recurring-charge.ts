import { z } from "zod";
import { RECURRING_CHARGE_TYPES } from "@/lib/form-options";

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function isValidMoney(value: string) {
  return !Number.isNaN(Number(value)) && Number(value) >= 0;
}

export const recurringChargeSchema = z
  .object({
    contractId: z.string().trim().min(1, "Contract is required."),
    chargeType: z.enum(RECURRING_CHARGE_TYPES),
    label: z
      .string()
      .trim()
      .min(1, "Charge label is required.")
      .max(120, "Charge label must be 120 characters or fewer."),
    amount: z
      .string()
      .trim()
      .min(1, "Amount is required.")
      .refine(isValidMoney, "Amount must be a valid non-negative number."),
    effectiveStartDate: z
      .string()
      .trim()
      .min(1, "Effective start date is required.")
      .refine(isValidDate, "Enter a valid effective start date."),
    effectiveEndDate: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .refine((value) => !value || isValidDate(value), "Enter a valid effective end date."),
    isActive: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.effectiveEndDate) {
      return;
    }

    const startDate = new Date(value.effectiveStartDate);
    const endDate = new Date(value.effectiveEndDate);

    if (endDate < startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["effectiveEndDate"],
        message: "Effective end date must be on or after the effective start date.",
      });
    }
  });

export type RecurringChargeInput = z.infer<typeof recurringChargeSchema>;
