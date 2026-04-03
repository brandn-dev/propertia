import { z } from "zod";
import { INCREASE_TYPES, RENT_BASE_OPTIONS } from "@/lib/form-options";

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function parseDecimal(value: string) {
  return Number(value);
}

export const rentScheduleSchema = z.object({
  rows: z
    .array(z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("BASE"),
        effectiveDate: z
          .string()
          .trim()
          .min(1, "Effective date is required.")
          .refine(isValidDate, "Enter a valid effective date."),
        monthlyRent: z
          .string()
          .trim()
          .min(1, "Monthly rent is required.")
          .refine(
            (value) => !Number.isNaN(parseDecimal(value)) && parseDecimal(value) > 0,
            "Monthly rent must be a valid number greater than zero."
          ),
      }),
      z.object({
        kind: z.literal("ADJUSTMENT"),
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
        basedOn: z.enum(RENT_BASE_OPTIONS),
      }),
    ]))
    .min(1, "Add at least one rent schedule row."),
});

export type RentScheduleInput = z.infer<typeof rentScheduleSchema>;
