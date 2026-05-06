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

function isRetryablePrismaError(error: unknown) {
  return (
    error instanceof Error &&
    /Connection terminated unexpectedly|Can't reach database server|Timed out fetching a new connection/i.test(
      error.message
    )
  );
}

export async function withPrismaRetry<T>(
  run: () => Promise<T>,
  retries = 1
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (retries <= 0 || !isRetryablePrismaError(error)) {
      throw error;
    }

    return withPrismaRetry(run, retries - 1);
  }
}
