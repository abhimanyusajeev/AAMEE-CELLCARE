import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
export async function hashPassword(password: string) { return bcrypt.hash(password, 12); }
export async function verifyPassword(password: string, hash: string) { return bcrypt.compare(password, hash); }
export async function findUserForLogin(identifier: string) {
  return prisma.user.findFirst({ where: { OR: [{ email: identifier.toLowerCase() }, { phone: identifier }] } });
}

