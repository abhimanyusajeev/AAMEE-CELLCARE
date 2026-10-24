import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { z } from "zod";

const S = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(7).max(30),
  alternatePhone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function GET(req: NextRequest) {
  await requireAuth(req);
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    take: 500,
    include: { _count: { select: { sales: true, repairs: true, visits: true } } },
  });
  return NextResponse.json({ customers });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  const p = S.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ message: "Invalid customer details." }, { status: 400 });

  const customer = await prisma.$transaction(async (tx) => {
    const created = await tx.customer.create({
      data: {
        name: p.data.name,
        phone: p.data.phone,
        alternatePhone: p.data.alternatePhone || null,
        email: p.data.email || null,
        address: p.data.address || null,
        notes: p.data.notes || null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "CUSTOMER_CREATED",
        entityType: "Customer",
        entityId: created.id,
        afterData: {
          name: created.name,
          phone: created.phone,
          alternatePhone: created.alternatePhone,
          email: created.email,
          address: created.address,
          notes: created.notes,
        },
      },
    });
    return created;
  });

  return NextResponse.json({ customer }, { status: 201 });
}
