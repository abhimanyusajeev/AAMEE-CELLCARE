import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { ForbiddenError, requireOwner } from "@/lib/auth/session";

const UpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  phone: z.string().trim().min(7).max(30).optional().or(z.literal("")),
  password: z.string().min(12).max(256).optional().or(z.literal("")),
  branchIds: z.array(z.string().min(1)).min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  let owner: Awaited<ReturnType<typeof requireOwner>>; try { owner = await requireOwner(request); } catch (error) { if (error instanceof ForbiddenError) return NextResponse.json({ message: "Forbidden" }, { status: 403 }); throw error; }
  const { id } = await context.params;
  if (id === owner.id) return NextResponse.json({ message: "Use the account settings flow to change the owner account." }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!existing) return NextResponse.json({ message: "User not found." }, { status: 404 });
  if (existing.role !== "EMPLOYEE") return NextResponse.json({ message: "Only employee accounts can be managed here." }, { status: 400 });

  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid employee details." }, { status: 400 });

  if (parsed.data.branchIds) {
    const ids = [...new Set(parsed.data.branchIds)];
    const count = await prisma.branch.count({ where: { id: { in: ids }, isActive: true } });
    if (count !== ids.length) return NextResponse.json({ message: "One or more selected branches are invalid or inactive." }, { status: 400 });
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          name: parsed.data.name,
          email: parsed.data.email === "" ? null : parsed.data.email,
          phone: parsed.data.phone === "" ? null : parsed.data.phone,
          ...(parsed.data.password ? { passwordHash: await hashPassword(parsed.data.password) } : {}),
          ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {}),
        },
        select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
      });

      if (parsed.data.branchIds) {
        await tx.userBranchAssignment.deleteMany({ where: { userId: id } });
        await tx.userBranchAssignment.createMany({
          data: [...new Set(parsed.data.branchIds)].map((branchId) => ({ userId: id, branchId })),
        });
      }

      if (parsed.data.isActive === false) {
        await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      }

      return updated;
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ message: "Email or phone is already in use." }, { status: 409 });
    }
    return NextResponse.json({ message: "Unable to update employee." }, { status: 500 });
  }
}
