"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { requireRole } from "@/lib/auth/user";
import { APP_CAPABILITIES, type AppCapability, type AppRole } from "@/lib/auth/roles";
import { hashPassword } from "@/lib/auth/password";
import { getSession } from "@/lib/auth/session";
import {
  getUserAvatarFileError,
  removeUserAvatarFile,
  storeUserAvatarFile,
} from "@/lib/properties/logo-storage";
import { prisma } from "@/lib/prisma";
import { createUserSchema, updateUserSchema } from "@/lib/validations/user";

export type UserFormState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

function revalidateUserViews() {
  [
    "/users",
    "/dashboard",
    "/properties",
    "/tenants",
    "/people",
    "/contracts",
    "/billing",
    "/utilities",
  ].forEach((path) => revalidatePath(path));
}

function getUserPayload(formData: FormData) {
  return {
    displayName: String(formData.get("displayName") ?? ""),
    username: String(formData.get("username") ?? ""),
    role: String(formData.get("role") ?? "") as AppRole,
    password: String(formData.get("password") ?? ""),
    capabilities: formData
      .getAll("capabilities")
      .map((value) => String(value))
      .filter((value): value is AppCapability =>
        APP_CAPABILITIES.includes(value as AppCapability)
      ),
    removeAvatar: formData.get("removeAvatar") === "true",
  };
}

function normalizeCapabilities(role: AppRole, capabilities: AppCapability[]) {
  if (role === "ADMIN") {
    return [];
  }

  const normalized = new Set<AppCapability>(capabilities);

  if (normalized.size > 0) {
    normalized.add("VIEW_DASHBOARD");
  }

  return APP_CAPABILITIES.filter((capability) => normalized.has(capability));
}

async function resolveUserAvatarInput(
  formData: FormData,
  currentAvatar?: {
    avatarUrl: string | null;
    avatarStorageKey: string | null;
  }
) {
  const avatarFile = formData.get("avatarFile");
  const removeAvatar = formData.get("removeAvatar") === "true";
  const nextAvatarFile =
    avatarFile instanceof File && avatarFile.size > 0 ? avatarFile : null;

  if (nextAvatarFile) {
    const avatarFileError = getUserAvatarFileError(nextAvatarFile);

    if (avatarFileError) {
      return {
        error: avatarFileError,
      };
    }

    const storedAvatar = await storeUserAvatarFile(nextAvatarFile);

    return {
      avatarUrl: storedAvatar.logoUrl,
      avatarStorageKey: storedAvatar.logoStorageKey,
      replacedStorageKey: currentAvatar?.avatarStorageKey ?? null,
    };
  }

  if (removeAvatar) {
    return {
      avatarUrl: null,
      avatarStorageKey: null,
      replacedStorageKey: currentAvatar?.avatarStorageKey ?? null,
    };
  }

  return {
    avatarUrl: currentAvatar?.avatarUrl ?? null,
    avatarStorageKey: currentAvatar?.avatarStorageKey ?? null,
    replacedStorageKey: null,
  };
}

async function usernameExists(username: string, userId?: string) {
  const match = await prisma.user.findFirst({
    where: {
      username,
      ...(userId ? { id: { not: userId } } : {}),
    },
    select: { id: true },
  });

  return Boolean(match);
}

export async function createUserAction(
  _previousState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireRole("ADMIN");

  const validatedFields = createUserSchema.safeParse(getUserPayload(formData));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted user fields and try again.",
    };
  }

  const data = validatedFields.data;
  const normalizedUsername = data.username.trim().toLowerCase();
  const capabilities = normalizeCapabilities(data.role, data.capabilities);

  if (data.role === "STAFF" && capabilities.length === 0) {
    return {
      errors: {
        capabilities: ["Pick at least one capability for staff users."],
      },
      message: "Staff users need at least one capability.",
    };
  }

  if (await usernameExists(normalizedUsername)) {
    return {
      errors: {
        username: ["That username is already in use."],
      },
      message: "Username must be unique.",
    };
  }

  const avatarInput = await resolveUserAvatarInput(formData);

  if ("error" in avatarInput) {
    return {
      errors: {
        avatarFile: [avatarInput.error ?? "Avatar file is invalid."],
      },
      message: "Avatar could not be saved.",
    };
  }

  const credentials = await hashPassword(data.password);

  try {
    await prisma.user.create({
      data: {
        username: normalizedUsername,
        displayName: data.displayName,
        role: data.role,
        capabilities,
        passwordHash: credentials.hash,
        passwordSalt: credentials.salt,
        isActive: true,
        avatarUrl: avatarInput.avatarUrl,
        avatarStorageKey: avatarInput.avatarStorageKey,
      },
    });
  } catch {
    if (avatarInput.avatarStorageKey) {
      await removeUserAvatarFile(avatarInput.avatarStorageKey);
    }

    return {
      message: "User could not be saved. Try again.",
    };
  }

  revalidateUserViews();
  redirect("/users", RedirectType.replace);
}

export async function updateUserAction(
  userId: string,
  _previousState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  await requireRole("ADMIN");

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      avatarUrl: true,
      avatarStorageKey: true,
      passwordHash: true,
      passwordSalt: true,
    },
  });

  if (!existingUser) {
    return {
      message: "User no longer exists.",
    };
  }

  const validatedFields = updateUserSchema.safeParse(getUserPayload(formData));

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Fix the highlighted user fields and try again.",
    };
  }

  const data = validatedFields.data;
  const normalizedUsername = data.username.trim().toLowerCase();
  const capabilities = normalizeCapabilities(data.role, data.capabilities);

  if (data.role === "STAFF" && capabilities.length === 0) {
    return {
      errors: {
        capabilities: ["Pick at least one capability for staff users."],
      },
      message: "Staff users need at least one capability.",
    };
  }

  if (await usernameExists(normalizedUsername, userId)) {
    return {
      errors: {
        username: ["That username is already in use."],
      },
      message: "Username must be unique.",
    };
  }

  const avatarInput = await resolveUserAvatarInput(formData, existingUser);

  if ("error" in avatarInput) {
    return {
      errors: {
        avatarFile: [avatarInput.error ?? "Avatar file is invalid."],
      },
      message: "Avatar could not be saved.",
    };
  }

  const nextPassword =
    data.password.length > 0 ? await hashPassword(data.password) : null;

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        username: normalizedUsername,
        displayName: data.displayName,
        role: data.role,
        capabilities,
        ...(nextPassword
          ? {
              passwordHash: nextPassword.hash,
              passwordSalt: nextPassword.salt,
            }
          : {}),
        avatarUrl: avatarInput.avatarUrl,
        avatarStorageKey: avatarInput.avatarStorageKey,
      },
    });
  } catch {
    if (
      avatarInput.avatarStorageKey &&
      avatarInput.avatarStorageKey !== existingUser.avatarStorageKey
    ) {
      await removeUserAvatarFile(avatarInput.avatarStorageKey);
    }

    return {
      message: "User could not be updated. Try again.",
    };
  }

  if (avatarInput.replacedStorageKey) {
    await removeUserAvatarFile(avatarInput.replacedStorageKey);
  }

  revalidateUserViews();
  redirect("/users", RedirectType.replace);
}

export async function toggleUserActiveAction(userId: string, nextActive: boolean) {
  const currentUser = await requireRole("ADMIN");

  if (currentUser.id === userId && !nextActive) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: nextActive },
  });

  revalidateUserViews();
}

export async function deleteOwnUserAction(
  userId: string,
  previousState: UserFormState,
  formData: FormData
): Promise<UserFormState> {
  void previousState;
  void formData;

  const currentUser = await requireRole("ADMIN");

  if (currentUser.id !== userId) {
    return {
      message: "Only your own account can be deleted here.",
    };
  }

  const otherAdminCount = await prisma.user.count({
    where: {
      role: "ADMIN",
      id: { not: userId },
      isActive: true,
    },
  });

  if (otherAdminCount === 0) {
    return {
      message: "Create another active admin before deleting this account.",
    };
  }

  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      avatarStorageKey: true,
    },
  });

  await prisma.user.delete({
    where: { id: userId },
  });

  if (existingUser?.avatarStorageKey) {
    await removeUserAvatarFile(existingUser.avatarStorageKey);
  }

  const session = await getSession();
  session.destroy();

  revalidateUserViews();
  redirect("/login");
}
