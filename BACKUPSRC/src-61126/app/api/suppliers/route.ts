import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";

const Schema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email().optional(),
  address: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function GET(request: NextRequest) {
  await requireAuth(request);

  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { purchases: true } } },
  });

  return NextResponse.json({ suppliers });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  const parsed = Schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid supplier details." }, { status: 400 });
  }

  const data = {
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    notes: parsed.data.notes || null,
  };

  const supplier = await prisma.$transaction(async (tx) => {
    const created = await tx.supplier.create({ data });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "SUPPLIER_CREATED",
        entityType: "Supplier",
        entityId: created.id,
        afterData: {
          name: created.name,
          phone: created.phone,
          email: created.email,
          address: created.address,
          notes: created.notes,
          isActive: created.isActive,
        },
      },
    });

    return created;
  });

  return NextResponse.json({ supplier }, { status: 201 });
}
