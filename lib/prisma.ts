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

export function isRetryablePrismaError(error: unknown) {
  let current: unknown = error;

  while (current instanceof Error) {
    const code = "code" in current ? String(current.code) : "";

    if (
      /P1001|P1017|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE/i.test(code) ||
      /Connection terminated unexpectedly|Can't reach database server|Timed out fetching a new connection|Connection closed|server closed the connection unexpectedly|connection reset by peer|socket hang up/i.test(
        current.message
      )
    ) {
      return true;
    }

    current = current.cause;
  }

  return false;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withPrismaRetry<T>(
  run: () => Promise<T>,
  retries = 3,
  delayMs = 250
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (retries <= 0 || !isRetryablePrismaError(error)) {
      throw error;
    }

    await wait(delayMs);
    return withPrismaRetry(run, retries - 1, Math.min(delayMs * 2, 2000));
  }
}
