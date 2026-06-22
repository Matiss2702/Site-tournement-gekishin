import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function getConnectionString() {
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url || url.startsWith("prisma+")) {
    throw new Error(
      "DIRECT_DATABASE_URL must be set to a postgres:// connection string"
    );
  }
  return url;
}

function getPool() {
  if (!globalForPrisma.pool) {
    const pool = new Pool({
      connectionString: getConnectionString(),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on("error", (err) => {
      console.error("[prisma] Postgres pool error:", err.message);
    });
    globalForPrisma.pool = pool;
  }
  return globalForPrisma.pool;
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg(getPool());
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();

export async function withPrismaRetry<T>(
  fn: () => Promise<T>,
  retries = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;

    const message = error instanceof Error ? error.message : "";
    const cause =
      error && typeof error === "object" && "cause" in error
        ? error.cause
        : null;
    const pgMessage =
      cause && typeof cause === "object" && "message" in cause
        ? String(cause.message)
        : "";

    const transient =
      message.includes("bind message supplies") ||
      pgMessage.includes("bind message supplies") ||
      message.includes("timeout exceeded when trying to connect") ||
      message.includes("Cannot read properties of null") ||
      message.includes("DriverAdapterError");

    if (!transient) throw error;

    await new Promise((resolve) => setTimeout(resolve, 150));
    return withPrismaRetry(fn, retries - 1);
  }
}
