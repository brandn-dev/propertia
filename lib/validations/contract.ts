import { z } from "zod";
import {
  ADVANCE_RENT_APPLICATIONS,
  CONTRACT_STATUSES,
} from "@/lib/form-options";

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function parseDecimal(value: string) {
  return Number(value);
}

function parseInteger(value: string) {
  return Number(value);
}

export const contractSchema = z
  .object({
    propertyId: z.string().trim().min(1, "Property is required."),
    tenantId: z.string().trim().min(1, "Tenant is required."),
    startDate: z
      .string()
      .trim()
      .min(1, "Start date is required.")
      .refine(isValidDate, "Enter a valid start date."),
    endDate: z
      .string()
      .trim()
      .min(1, "End date is required.")
      .refine(isValidDate, "Enter a valid end date."),
    paymentStartDate: z
      .string()
      .trim()
      .min(1, "Billing cycle start is required.")
      .refine(isValidDate, "Enter a valid billing cycle start date."),
    monthlyRent: z
      .string()
      .trim()
      .min(1, "Monthly rent is required.")
      .refine(
        (value) => !Number.isNaN(parseDecimal(value)) && parseDecimal(value) >= 0,
        "Monthly rent must be a valid non-negative number."
      ),
    advanceRentMonths: z
      .string()
      .trim()
      .default("0")
      .refine(
        (value) =>
          value === "" ||
          (Number.isInteger(parseInteger(value)) && parseInteger(value) >= 0),
        "Advance rent months must be a valid non-negative whole number."
      ),
    securityDepositMonths: z
      .string()
      .trim()
      .default("0")
      .refine(
        (value) =>
          value === "" ||
          (Number.isInteger(parseInteger(value)) && parseInteger(value) >= 0),
        "Security deposit months must be a valid non-negative whole number."
      ),
    freeRentCycles: z
      .string()
      .trim()
      .default("0")
      .refine(
        (value) =>
          value === "" ||
          (Number.isInteger(parseInteger(value)) && parseInteger(value) >= 0),
        "Free-rent cycles must be a valid non-negative whole number."
      ),
    advanceRentApplication: z.enum(ADVANCE_RENT_APPLICATIONS),
    status: z.enum(CONTRACT_STATUSES),
    notes: z
      .string()
      .trim()
      .max(1000, "Notes must be 1000 characters or fewer.")
      .transform((value) => value || undefined),
  })
  .superRefine((value, ctx) => {
    const start = new Date(value.startDate);
    const end = new Date(value.endDate);
    const paymentStart = new Date(value.paymentStartDate);

    if (end <= start) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be after the start date.",
      });
    }

    if (paymentStart < start) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentStartDate"],
        message: "Billing cycle start cannot be earlier than the contract start date.",
      });
    }

    if (paymentStart > end) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentStartDate"],
        message: "Billing cycle start must fall within the contract period.",
      });
    }
  });

export type ContractInput = z.infer<typeof contractSchema>;
