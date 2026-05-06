import { z } from "zod";
import {
  BACKLOG_ADJUSTMENT_TYPES,
  BACKLOG_PAYMENT_STATUSES,
  UTILITY_TYPES,
} from "@/lib/form-options";

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function isNonNegativeNumber(value: string) {
  return !Number.isNaN(Number(value)) && Number(value) >= 0;
}

function isMoneyNumber(value: string) {
  return !Number.isNaN(Number(value));
}

export const backlogUtilityReadingRowSchema = z
  .object({
    meterId: z.string().trim().min(1, "Meter is required."),
    readingDate: z
      .string()
      .trim()
      .min(1, "Reading date is required.")
      .refine(isValidDate, "Enter a valid reading date."),
    previousReading: z
      .string()
      .trim()
      .min(1, "Previous reading is required.")
      .refine(
        isNonNegativeNumber,
        "Previous reading must be a valid non-negative number."
      ),
    currentReading: z
      .string()
      .trim()
      .min(1, "Current reading is required.")
      .refine(
        isNonNegativeNumber,
        "Current reading must be a valid non-negative number."
      ),
    ratePerUnit: z
      .string()
      .trim()
      .min(1, "Rate per unit is required.")
      .refine(
        isNonNegativeNumber,
        "Rate per unit must be a valid non-negative number."
      ),
  })
  .superRefine((value, ctx) => {
    if (Number(value.currentReading) < Number(value.previousReading)) {
      ctx.addIssue({
        code: "custom",
        path: ["currentReading"],
        message: "Current reading cannot be lower than previous reading.",
      });
    }
  });

export const backlogUtilityChargeRowSchema = z.object({
  utilityType: z.enum(UTILITY_TYPES),
  label: z
    .string()
    .trim()
    .max(120, "Utility label must be 120 characters or fewer.")
    .transform((value) => value || undefined),
  amount: z
    .string()
    .trim()
    .min(1, "Utility amount is required.")
    .refine(
      isNonNegativeNumber,
      "Utility amount must be a valid non-negative number."
    ),
});

export const backlogAdjustmentRowSchema = z.object({
  itemType: z.enum(BACKLOG_ADJUSTMENT_TYPES),
  label: z
    .string()
    .trim()
    .min(1, "Adjustment label is required.")
    .max(120, "Adjustment label must be 120 characters or fewer."),
  amount: z
    .string()
    .trim()
    .min(1, "Adjustment amount is required.")
    .refine(isMoneyNumber, "Adjustment amount must be a valid number.")
    .refine((value) => Number(value) !== 0, "Adjustment amount cannot be zero."),
});

export const backlogBulkRowSchema = z
  .object({
    rowKey: z.string().trim().min(1, "Row key is required."),
    contractId: z.string().trim().min(1, "Contract is required."),
    billingPeriodStart: z
      .string()
      .trim()
      .min(1, "Billing period start is required.")
      .refine(isValidDate, "Enter a valid billing period start."),
    billingPeriodEnd: z
      .string()
      .trim()
      .min(1, "Billing period end is required.")
      .refine(isValidDate, "Enter a valid billing period end."),
    issueDate: z
      .string()
      .trim()
      .min(1, "Issue date is required.")
      .refine(isValidDate, "Enter a valid issue date."),
    dueDate: z
      .string()
      .trim()
      .min(1, "Due date is required.")
      .refine(isValidDate, "Enter a valid due date."),
    rentAmount: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .refine(
        (value) => !value || isNonNegativeNumber(value),
        "Rent amount must be a valid non-negative number."
      ),
    manualUtilityAmount: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .refine(
        (value) => !value || isNonNegativeNumber(value),
        "Manual utility amount must be a valid non-negative number."
      ),
    utilityNote: z
      .string()
      .trim()
      .max(200, "Utility note must be 200 characters or fewer.")
      .transform((value) => value || undefined),
    adjustmentAmount: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .refine(
        (value) => !value || isMoneyNumber(value),
        "Adjustment amount must be a valid number."
      ),
    arrearsAmount: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .refine(
        (value) => !value || isMoneyNumber(value),
        "Arrears amount must be a valid number."
      ),
    paymentStatus: z.enum(BACKLOG_PAYMENT_STATUSES),
    paymentAmount: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .refine(
        (value) => !value || isNonNegativeNumber(value),
        "Payment amount must be a valid non-negative number."
      ),
    paymentDate: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .refine((value) => !value || isValidDate(value), "Enter a valid payment date."),
    referenceNumber: z
      .string()
      .trim()
      .max(120, "Reference number must be 120 characters or fewer.")
      .transform((value) => value || undefined),
    notes: z
      .string()
      .trim()
      .max(1000, "Notes must be 1000 characters or fewer.")
      .transform((value) => value || undefined),
    readingMissing: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.paymentStatus !== "UNPAID" && !value.paymentDate) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentDate"],
        message: "Payment date is required when payment status is not unpaid.",
      });
    }

    if (value.paymentStatus === "PARTIAL" && !value.paymentAmount) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentAmount"],
        message: "Partial payment amount is required.",
      });
    }
  });

export const backlogBulkRowsSchema = z.array(backlogBulkRowSchema);

export const backlogPaymentSnapshotSchema = z
  .object({
    status: z.enum(BACKLOG_PAYMENT_STATUSES),
    amount: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .refine(
        (value) => !value || isNonNegativeNumber(value),
        "Payment amount must be a valid non-negative number."
      ),
    paymentDate: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .refine((value) => !value || isValidDate(value), "Enter a valid payment date."),
    referenceNumber: z
      .string()
      .trim()
      .max(120, "Reference number must be 120 characters or fewer.")
      .transform((value) => value || undefined),
    notes: z
      .string()
      .trim()
      .max(1000, "Payment notes must be 1000 characters or fewer.")
      .transform((value) => value || undefined),
  })
  .superRefine((value, ctx) => {
    if (value.status === "UNPAID") {
      return;
    }

    if (!value.paymentDate) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentDate"],
        message: "Payment date is required when recording backlog payment.",
      });
    }

    if (value.status === "PARTIAL" && !value.amount) {
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Partial payment amount is required.",
      });
    }
  });

export const historicalBacklogSchema = z.object({
  contractId: z.string().trim().min(1, "Contract is required."),
  billingPeriodStart: z
    .string()
    .trim()
    .min(1, "Billing period start is required.")
    .refine(isValidDate, "Enter a valid billing period start."),
  billingPeriodEnd: z
    .string()
    .trim()
    .min(1, "Billing period end is required.")
    .refine(isValidDate, "Enter a valid billing period end."),
  issueDate: z
    .string()
    .trim()
    .min(1, "Issue date is required.")
    .refine(isValidDate, "Enter a valid issue date."),
  dueDate: z
    .string()
    .trim()
    .min(1, "Due date is required.")
    .refine(isValidDate, "Enter a valid due date."),
  rentAmount: z
    .string()
    .trim()
    .transform((value) => value || undefined)
    .refine(
      (value) => !value || isNonNegativeNumber(value),
      "Rent amount must be a valid non-negative number."
    ),
  utilityReadings: z.array(backlogUtilityReadingRowSchema),
  utilityCharges: z.array(backlogUtilityChargeRowSchema),
  adjustments: z.array(backlogAdjustmentRowSchema),
  payment: backlogPaymentSnapshotSchema,
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1000 characters or fewer.")
    .transform((value) => value || undefined),
});

export type HistoricalBacklogInput = z.infer<typeof historicalBacklogSchema>;
export type HistoricalBacklogBulkRowInput = z.infer<typeof backlogBulkRowSchema>;
