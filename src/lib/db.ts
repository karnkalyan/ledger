import { PrismaClient } from "@/generated/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

