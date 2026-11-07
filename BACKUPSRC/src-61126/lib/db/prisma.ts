import { PrismaClient } from "@prisma/client";

declare global { var __aameePrisma: PrismaClient | undefined; }
export const prisma =
  globalThis.__aameePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 15_000,
    },
  });
if (process.env.NODE_ENV !== "production") globalThis.__aameePrisma = prisma;

