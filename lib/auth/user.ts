import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma, withPrismaRetry } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import type { AppRole } from "@/lib/auth/roles";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: AppRole;
  isActive: boolean;
  lastLoginAt: Date | null;
};

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getSession();

  if (!session.isLoggedIn || !session.userId) {
    return null;
  }

  const user = await withPrismaRetry(() =>
    prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
      },
    })
  );

  if (!user || !user.isActive) {
    return null;
  }

  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export async function requireRole(roles: AppRole | AppRole[]) {
  const user = await requireUser();
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(user.role)) {
    redirect("/unauthorized");
  }

  return user;
}
