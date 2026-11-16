import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireBranchAccess } from "@/lib/auth/session";

const Schema = z.object({
  branchId: z.string().min(1),
  type: z.string().trim().min(2).max(80),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  visitedAt: z.string().datetime().optional(),
});

async function branchIdsForUser(userId: string, role: "OWNER" | "EMPLOYEE") {
  if (role === "OWNER") return null;
  const rows = await prisma.userBranchAssignment.findMany({ where: { userId }, select: { branchId: true } });
  return rows.map((row) => row.branchId);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  const { id } = await params;
  const allowedBranches = await branchIdsForUser(user.id, user.role as "OWNER" | "EMPLOYEE");

  const visits = await prisma.customerVisit.findMany({
    where: {
      customerId: id,
      ...(allowedBranches ? { branchId: { in: allowedBranches } } : {}),
    },
    orderBy: { visitedAt: "desc" },
    take: 100,
    include: { branch: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ visits });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  const { id } = await params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid visit details." }, { status: 400 });

  const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true } });
  if (!customer) return NextResponse.json({ message: "Customer not found." }, { status: 404 });

  try {
    await requireBranchAccess(user.id, user.role as "OWNER" | "EMPLOYEE", parsed.data.branchId);
  } catch {
    return NextResponse.json({ message: "You do not have access to this branch." }, { status: 403 });
  }

  const visit = await prisma.$transaction(async (tx) => {
    const created = await tx.customerVisit.create({
      data: {
        customerId: id,
        branchId: parsed.data.branchId,
        type: parsed.data.type,
        note: parsed.data.note || null,
        createdById: user.id,
        visitedAt: parsed.data.visitedAt ? new Date(parsed.data.visitedAt) : new Date(),
      },
      include: { branch: { select: { id: true, name: true } }, createdBy: { select: { id: true, name: true } } },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        branchId: created.branchId,
        action: "CUSTOMER_VISIT_CREATED",
        entityType: "CustomerVisit",
        entityId: created.id,
        afterData: { customerId: id, type: created.type, note: created.note, visitedAt: created.visitedAt.toISOString() },
      },
    });

    return created;
  });

  return NextResponse.json({ visit }, { status: 201 });
}
