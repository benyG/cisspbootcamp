import { PrismaClient } from "@prisma/client";

/**
 * A single Prisma client per process. Next.js hot-reload re-evaluates modules,
 * so the instance is parked on globalThis to avoid exhausting MySQL connections.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
