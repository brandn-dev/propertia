import { z } from "zod";
import {
  INCREASE_TYPES,
  RENT_BASE_OPTIONS,
  RENT_CALCULATION_TYPES,
} from "@/lib/form-options";

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function parseDecimal(value: string) {
  return Number(value);
}

export const rentAdjustmentSchema = z.object({
  effectiveDate: z
    .string()
    .trim()
    .min(1, "Effective date is required.")
    .refine(isValidDate, "Enter a valid effective date."),
  increaseType: z.enum(INCREASE_TYPES),
  increaseValue: z
    .string()
    .trim()
    .min(1, "Increase value is required.")
    .refine(
      (value) => !Number.isNaN(parseDecimal(value)) && parseDecimal(value) > 0,
      "Increase value must be a valid number greater than zero."
    ),
  calculationType: z.enum(RENT_CALCULATION_TYPES),
  basedOn: z.enum(RENT_BASE_OPTIONS),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer.")
    .transform((value) => value || undefined),
});

export type RentAdjustmentInput = z.infer<typeof rentAdjustmentSchema>;
