import { z } from "zod";

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function isNonNegativeNumber(value: string) {
  return !Number.isNaN(Number(value)) && Number(value) >= 0;
}

export const meterReadingSchema = z.object({
  meterId: z.string().trim().min(1, "Meter is required."),
  readingDate: z
    .string()
    .trim()
    .min(1, "Reading date is required.")
    .refine(isValidDate, "Enter a valid reading date."),
  currentReading: z
    .string()
    .trim()
    .min(1, "Current reading is required.")
    .refine(isNonNegativeNumber, "Current reading must be a valid non-negative number."),
  ratePerUnit: z
    .string()
    .trim()
    .min(1, "Rate per unit is required.")
    .refine(isNonNegativeNumber, "Rate per unit must be a valid non-negative number."),
});

export type MeterReadingInput = z.infer<typeof meterReadingSchema>;
