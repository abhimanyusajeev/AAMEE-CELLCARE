import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/auth/password";
import { ForbiddenError, requireOwner } from "@/lib/auth/session";

const CreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  phone: z.string().trim().min(7).max(30).optional().or(z.literal("")),
  password: z.string().min(12).max(256),
  branchIds: z.array(z.string().min(1)).min(1),
});

export async function GET(request: NextRequest) {
  try { await requireOwner(request); } catch (error) { if (error instanceof ForbiddenError) return NextResponse.json({ message: "Forbidden" }, { status: 403 }); throw error; }
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      isActive: true,
      createdAt: true,
      branchAssignments: { include: { branch: { select: { id: true, name: true, code: true } } } },
    },
  });
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  let owner: Awaited<ReturnType<typeof requireOwner>>; try { owner = await requireOwner(request); } catch (error) { if (error instanceof ForbiddenError) return NextResponse.json({ message: "Forbidden" }, { status: 403 }); throw error; }
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid employee details." }, { status: 400 });

  const branchIds = [...new Set(parsed.data.branchIds)];
  const validBranches = await prisma.branch.count({ where: { id: { in: branchIds }, isActive: true } });
  if (validBranches !== branchIds.length) {
    return NextResponse.json({ message: "One or more selected branches are invalid or inactive." }, { status: 400 });
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          passwordHash: await hashPassword(parsed.data.password),
          role: "EMPLOYEE",
          isActive: true,
          branchAssignments: {
            create: branchIds.map((branchId) => ({ branchId })),
          },
        },
        select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
      });
      return created;
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ message: "Email or phone is already in use." }, { status: 409 });
    }
    return NextResponse.json({ message: "Unable to create employee." }, { status: 500 });
  }
}

