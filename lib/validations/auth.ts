import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters long.")
    .max(32, "Username must not exceed 32 characters.")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Use letters, numbers, dots, dashes, or underscores only."
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .max(128, "Password must not exceed 128 characters."),
});

export type LoginActionState =
  | {
      errors?: {
        username?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;
