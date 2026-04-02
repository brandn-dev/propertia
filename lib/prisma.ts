import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
};

const LEGACY_SSL_MODES = new Set(["prefer", "require", "verify-ca"]);

function normalizeDatabaseUrl(connectionString: string) {
  try {
    const url = new URL(connectionString);

    if (url.searchParams.get("uselibpqcompat") === "true") {
      return connectionString;
    }

    const sslmode = url.searchParams.get("sslmode");

    if (sslmode && LEGACY_SSL_MODES.has(sslmode)) {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
  } catch {
    return connectionString;
  }

  return connectionString;
}

function getDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return normalizeDatabaseUrl(connectionString);
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: getDatabaseUrl() }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
