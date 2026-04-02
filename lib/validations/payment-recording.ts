import { z } from "zod";

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

function isValidMoney(value: string) {
  return !Number.isNaN(Number(value)) && Number(value) >= 0;
}

export const paymentAllocationInputSchema = z.object({
  invoiceItemId: z.string().trim().min(1, "Invoice item is required."),
  amount: z
    .string()
    .trim()
    .min(1, "Allocation amount is required.")
    .refine(isValidMoney, "Allocation amount must be a valid non-negative number."),
});

export const paymentRecordingSchema = z
  .object({
    paymentDate: z
      .string()
      .trim()
      .min(1, "Payment date is required.")
      .refine(isValidDate, "Enter a valid payment date."),
    referenceNumber: z
      .string()
      .trim()
      .max(120, "Reference number must be 120 characters or fewer.")
      .transform((value) => value || undefined),
    notes: z
      .string()
      .trim()
      .max(500, "Notes must be 500 characters or fewer.")
      .transform((value) => value || undefined),
    allocations: z.array(paymentAllocationInputSchema),
  })
  .superRefine((value, ctx) => {
    const positiveAllocations = value.allocations.filter(
      (allocation) => Number(allocation.amount) > 0
    );

    if (positiveAllocations.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["allocations"],
        message: "Enter at least one positive allocation amount.",
      });
    }
  });

export type PaymentRecordingInput = z.infer<typeof paymentRecordingSchema>;
