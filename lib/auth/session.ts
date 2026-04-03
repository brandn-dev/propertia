import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import type { AppRole } from "@/lib/auth/roles";

export type SessionData = {
  isLoggedIn: boolean;
  userId?: string;
  username?: string;
  displayName?: string;
  role?: AppRole;
};

export function getSessionPassword() {
  const password = process.env.SESSION_PASSWORD;

  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_PASSWORD must be set and contain at least 32 characters."
    );
  }

  return password;
}

function getSessionOptions() {
  return {
    cookieName: "propertia_session",
    password: getSessionPassword(),
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  };
}

export const getSession = cache(async () => {
  const session = await getIronSession<SessionData>(
    await cookies(),
    getSessionOptions()
  );

  session.isLoggedIn ??= false;

  return session;
});
