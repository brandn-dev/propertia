import { z } from "zod";

function isValidDate(value: string) {
  return !Number.isNaN(new Date(value).getTime());
}

export const invoiceGenerationSchema = z
  .object({
    contractId: z
      .string()
      .trim()
      .transform((value) => value || undefined),
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
  });

export type InvoiceGenerationInput = z.infer<typeof invoiceGenerationSchema>;
