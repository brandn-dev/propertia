import { z } from "zod";

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{6})$/;

export const INVOICE_TITLE_SCALES = [
  "COMPACT",
  "STANDARD",
  "PROMINENT",
] as const;
export const INVOICE_FONT_WEIGHTS = ["500", "600", "700", "800"] as const;
const FONT_SIZE_PERCENT_MIN = 80;
const FONT_SIZE_PERCENT_MAX = 140;

export const invoiceBrandingTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Template name is required.")
    .max(120, "Template name must be 120 characters or fewer."),
  brandName: z
    .string()
    .trim()
    .min(1, "Brand name is required.")
    .max(120, "Brand name must be 120 characters or fewer."),
  brandSubtitle: z
    .string()
    .trim()
    .min(1, "Brand subtitle is required.")
    .max(160, "Brand subtitle must be 160 characters or fewer."),
  invoiceTitlePrefix: z
    .string()
    .trim()
    .min(1, "Invoice title prefix is required.")
    .max(60, "Invoice title prefix must be 60 characters or fewer."),
  usePropertyLogo: z.boolean(),
  titleScale: z.enum(INVOICE_TITLE_SCALES),
  logoScalePercent: z.coerce
    .number()
    .int()
    .min(60, "Logo size must be at least 60%.")
    .max(160, "Logo size must be 160% or less."),
  brandNameSizePercent: z.coerce
    .number()
    .int()
    .min(FONT_SIZE_PERCENT_MIN, `Brand size must be at least ${FONT_SIZE_PERCENT_MIN}%.`)
    .max(FONT_SIZE_PERCENT_MAX, `Brand size must be ${FONT_SIZE_PERCENT_MAX}% or less.`),
  brandSubtitleSizePercent: z.coerce
    .number()
    .int()
    .min(FONT_SIZE_PERCENT_MIN, `Subtitle size must be at least ${FONT_SIZE_PERCENT_MIN}%.`)
    .max(FONT_SIZE_PERCENT_MAX, `Subtitle size must be ${FONT_SIZE_PERCENT_MAX}% or less.`),
  tenantNameSizePercent: z.coerce
    .number()
    .int()
    .min(FONT_SIZE_PERCENT_MIN, `Tenant size must be at least ${FONT_SIZE_PERCENT_MIN}%.`)
    .max(FONT_SIZE_PERCENT_MAX, `Tenant size must be ${FONT_SIZE_PERCENT_MAX}% or less.`),
  titleSizePercent: z.coerce
    .number()
    .int()
    .min(FONT_SIZE_PERCENT_MIN, `Title size must be at least ${FONT_SIZE_PERCENT_MIN}%.`)
    .max(FONT_SIZE_PERCENT_MAX, `Title size must be ${FONT_SIZE_PERCENT_MAX}% or less.`),
  brandNameWeight: z.coerce
    .number()
    .int()
    .refine((value) => [500, 600, 700, 800].includes(value), "Invalid brand font weight."),
  tenantNameWeight: z.coerce
    .number()
    .int()
    .refine((value) => [500, 600, 700, 800].includes(value), "Invalid tenant font weight."),
  titleWeight: z.coerce
    .number()
    .int()
    .refine((value) => [500, 600, 700, 800].includes(value), "Invalid title font weight."),
  accentColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, "Accent color must be a 6-digit hex color."),
  labelColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, "Label color must be a 6-digit hex color."),
  valueColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, "Value color must be a 6-digit hex color."),
  mutedColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, "Muted color must be a 6-digit hex color."),
  panelBackground: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, "Panel background must be a 6-digit hex color."),
  isDefault: z.boolean(),
  removeLogo: z.boolean(),
});

export type InvoiceBrandingTemplateInput = z.infer<
  typeof invoiceBrandingTemplateSchema
>;
