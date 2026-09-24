import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";

const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
const phone = process.env.OWNER_PHONE?.trim() || null;
const password = process.env.OWNER_PASSWORD;

if (!email || !password) throw new Error("OWNER_EMAIL and OWNER_PASSWORD are required");
if (password.length < 12) throw new Error("OWNER_PASSWORD must be at least 12 characters");

const result = await prisma.$transaction(async (tx) => {
  const existing = await tx.user.findFirst({ where: { OR: [{ email }, ...(phone ? [{ phone }] : [])] }, select: { id: true } });
  if (existing) throw new Error("Owner account already exists");

  const owner = await tx.user.create({ data: { name: "Vishnu Prasad", email, phone, passwordHash: await hashPassword(password), role: "OWNER" } });

  const branches = await Promise.all([
    tx.branch.upsert({ where: { code: "PUN" }, update: { name: "Aamee Cellcare - Punnamoodu, Thuruthy", address: "Punnamoodu, Thuruthy", phone: "920 727 7210", email: "aameecellcare@gmail.com", invoicePrefix: "PUN-", isActive: true }, create: { code: "PUN", name: "Aamee Cellcare - Punnamoodu, Thuruthy", address: "Punnamoodu, Thuruthy", phone: "920 727 7210", email: "aameecellcare@gmail.com", invoicePrefix: "PUN-" } }),
    tx.branch.upsert({ where: { code: "CHA" }, update: { name: "Aamee Cellcare - Chalacira, Chettipuzha Road", address: "Chalacira Ju., Chettipuzha Road", phone: "920 727 7210", email: "aameecellcare@gmail.com", invoicePrefix: "CHA-", isActive: true }, create: { code: "CHA", name: "Aamee Cellcare - Chalacira, Chettipuzha Road", address: "Chalacira Ju., Chettipuzha Road", phone: "920 727 7210", email: "aameecellcare@gmail.com", invoicePrefix: "CHA-" } }),
  ]);

  await tx.businessSettings.upsert({ where: { id: 1 }, update: { gstEnabled: false, gstNumber: null, returnWindowDays: 15 }, create: { id: 1, gstEnabled: false, returnWindowDays: 15 } });
  return { ownerId: owner.id, branches: branches.map((b) => b.id) };
});

console.log(`Created owner ${result.ownerId} and verified ${result.branches.length} branches.`);
await prisma.$disconnect();
