import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";

const Schema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().min(7).max(30),
  alternatePhone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  const { id } = await params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid customer details." }, { status: 400 });

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ message: "Customer not found." }, { status: 404 });

  const customer = await prisma.$transaction(async (tx) => {
    const updated = await tx.customer.update({
      where: { id },
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone,
        alternatePhone: parsed.data.alternatePhone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
        notes: parsed.data.notes || null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "CUSTOMER_UPDATED",
        entityType: "Customer",
        entityId: updated.id,
        beforeData: {
          name: existing.name,
          phone: existing.phone,
          alternatePhone: existing.alternatePhone,
          email: existing.email,
          address: existing.address,
          notes: existing.notes,
        },
        afterData: {
          name: updated.name,
          phone: updated.phone,
          alternatePhone: updated.alternatePhone,
          email: updated.email,
          address: updated.address,
          notes: updated.notes,
        },
      },
    });

    return updated;
  });

  return NextResponse.json({ customer });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request);
  const { id } = await params;

  const existing = await prisma.customer.findUnique({
    where: { id },
    include: {
      _count: {
        select: { sales: true, repairs: true, visits: true, emiTransactions: true, returns: true },
      },
    },
  });

  if (!existing) return NextResponse.json({ message: "Customer not found." }, { status: 404 });

  const totalHistory = Object.values(existing._count).reduce((sum, count) => sum + count, 0);
  if (totalHistory > 0) {
    return NextResponse.json(
      { message: "This customer has transaction or visit history and cannot be deleted." },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.customer.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "CUSTOMER_DELETED",
        entityType: "Customer",
        entityId: id,
        beforeData: {
          name: existing.name,
          phone: existing.phone,
          email: existing.email,
        },
      },
    });
  });

  return NextResponse.json({ ok: true });
}
