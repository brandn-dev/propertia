import { z } from "zod";
import { CONTRACT_STATUSES } from "@/lib/form-options";

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function parseDecimal(value: string) {
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
      .min(1, "Payment start date is required.")
      .refine(isValidDate, "Enter a valid payment start date."),
    monthlyRent: z
      .string()
      .trim()
      .min(1, "Monthly rent is required.")
      .refine(
        (value) => !Number.isNaN(parseDecimal(value)) && parseDecimal(value) >= 0,
        "Monthly rent must be a valid non-negative number."
      ),
    advanceRent: z
      .string()
      .trim()
      .default("0")
      .refine(
        (value) => value === "" || (!Number.isNaN(parseDecimal(value)) && parseDecimal(value) >= 0),
        "Advance rent must be a valid non-negative number."
      ),
    securityDeposit: z
      .string()
      .trim()
      .default("0")
      .refine(
        (value) =>
          value === "" || (!Number.isNaN(parseDecimal(value)) && parseDecimal(value) >= 0),
        "Security deposit must be a valid non-negative number."
      ),
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
        message: "Payment start date cannot be earlier than the contract start date.",
      });
    }

    if (paymentStart > end) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentStartDate"],
        message: "Payment start date must fall within the contract period.",
      });
    }
  });

export type ContractInput = z.infer<typeof contractSchema>;
