"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import {
  type LoginActionState,
  loginSchema,
} from "@/lib/validations/auth";

function missingSetup() {
  return !process.env.DATABASE_URL || !process.env.SESSION_PASSWORD;
}

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  if (missingSetup()) {
    return {
      message:
        "Setup is incomplete. Add the database URLs and session password first.",
    };
  }

  const validatedFields = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted fields and try again.",
    };
  }

  try {
    const username = validatedFields.data.username.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || !user.isActive) {
      return {
        message: "Invalid username or password.",
      };
    }

    const passwordIsValid = await verifyPassword(
      validatedFields.data.password,
      user.passwordSalt,
      user.passwordHash
    );

    if (!passwordIsValid) {
      return {
        message: "Invalid username or password.",
      };
    }

    const session = await getSession();
    session.isLoggedIn = true;
    session.userId = user.id;
    session.username = user.username;
    session.displayName = user.displayName;
    session.role = user.role;
    await session.save();

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    return {
      message:
        "The database connection is not ready yet. Add your Neon URLs, run migrations, and seed the users.",
    };
  }

  revalidatePath("/");
  redirect("/dashboard");
}

export async function logoutAction() {
  const session = await getSession();
  session.destroy();

  revalidatePath("/");
  redirect("/login");
}
