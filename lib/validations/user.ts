import { z } from "zod";
import { APP_CAPABILITIES, APP_ROLES } from "@/lib/auth/roles";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters long.")
  .max(32, "Username must not exceed 32 characters.")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Use letters, numbers, dots, dashes, or underscores only."
  );

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long.")
  .max(128, "Password must not exceed 128 characters.");

const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Display name must be at least 2 characters long.")
  .max(64, "Display name must not exceed 64 characters.");

const capabilitySchema = z.enum(APP_CAPABILITIES);
const roleSchema = z.enum(APP_ROLES);

const baseUserSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  role: roleSchema,
  capabilities: z.array(capabilitySchema).default([]),
});

export const createUserSchema = baseUserSchema.extend({
  password: passwordSchema,
});

export const updateUserSchema = baseUserSchema.extend({
  password: z
    .string()
    .trim()
    .max(128, "Password must not exceed 128 characters.")
    .optional()
    .transform((value) => value ?? "")
    .refine((value) => value === "" || value.length >= 8, {
      message: "Password must be at least 8 characters long.",
    }),
});
