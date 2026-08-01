import { z } from "zod";
import {
  INVOICE_GENERATION_ADJUSTMENT_ACTIONS,
  INVOICE_GENERATION_ADJUSTMENT_VALUE_TYPES,
} from "@/lib/form-options";
import {
  INVOICE_ADJUSTMENT_TYPES,
  INVOICE_ADJUSTMENT_VALUE_TYPES,
} from "@/lib/billing/invoice-adjustments";

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

const invoiceGenerationLineAdjustmentSchema = z.object({
  cycleSelectionKey: z.string().trim().min(1),
  lineId: z.string().trim().min(1),
  action: z.enum(INVOICE_GENERATION_ADJUSTMENT_ACTIONS),
  valueType: z.enum(INVOICE_GENERATION_ADJUSTMENT_VALUE_TYPES),
  value: z.number().finite(),
});

const invoiceGenerationCarryForwardSelectionSchema = z.object({
  cycleSelectionKey: z.string().trim().min(1),
  carryForwardKey: z.string().trim().min(1),
});

const invoiceAdjustmentSchema = z.object({
  id: z.string().trim().min(1),
  cycleSelectionKey: z.string().trim().min(1),
  adjustmentType: z.enum(INVOICE_ADJUSTMENT_TYPES),
  valueType: z.enum(INVOICE_ADJUSTMENT_VALUE_TYPES),
  value: z.number().finite().positive("Adjustment value must be greater than zero."),
  targetLineId: z.string().trim().min(1, "Select an adjustment target."),
  label: z
    .string()
    .trim()
    .min(1, "Adjustment reason is required.")
    .max(160, "Adjustment reason must be 160 characters or fewer."),
});

export const invoiceGenerationSchema = z
  .object({
    tenantId: z.string().trim().min(1, "Select a business."),
    cycleSelections: z
      .array(z.string().trim().min(1))
      .min(1, "Select at least one invoice to generate."),
    readingSelections: z.array(z.string().trim().min(1)),
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
    lineAdjustments: z.array(invoiceGenerationLineAdjustmentSchema),
    invoiceAdjustments: z.array(invoiceAdjustmentSchema),
    carryForwardSelections: z.array(invoiceGenerationCarryForwardSelectionSchema),
  })
  .superRefine((value, ctx) => {
    const issueDate = new Date(value.issueDate);
    const dueDate = new Date(value.dueDate);

    if (dueDate < issueDate) {
      ctx.addIssue({
        code: "custom",
        path: ["dueDate"],
        message: "Due date must be on or after the issue date.",
      });
    }

    for (const adjustment of value.lineAdjustments) {
      if (adjustment.action === "FULL") {
        continue;
      }

      if (adjustment.value <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["lineAdjustments"],
          message: "Adjusted invoice lines need values greater than zero.",
        });
      }

      if (
        adjustment.valueType === "PERCENT" &&
        adjustment.value >= 100
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["lineAdjustments"],
          message: "Percentage deductions must stay below 100%.",
        });
      }
    }


    for (const adjustment of value.invoiceAdjustments) {
      if (adjustment.valueType === "PERCENTAGE" && adjustment.value > 100) {
        ctx.addIssue({
          code: "custom",
          path: ["invoiceAdjustments"],
          message: "Percentage adjustments cannot exceed 100%.",
        });
      }
    }
  });

export type InvoiceGenerationInput = z.infer<typeof invoiceGenerationSchema>;
