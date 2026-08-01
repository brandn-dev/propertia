import { z } from "zod";

export type PublicInvoiceAccessFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export const publicInvoiceAccessSchema = z.object({
  accessCode: z
    .string()
    .trim()
    .min(6, "Enter the 6-character invoice password.")
    .max(6, "Enter the 6-character invoice password.")
    .regex(/^[a-zA-Z0-9]{6}$/, "Invoice password must be 6 letters or numbers.")
    .transform((value) => value.toUpperCase()),
});
