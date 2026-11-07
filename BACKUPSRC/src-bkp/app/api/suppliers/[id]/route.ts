import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";

const UpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    email: z.string().trim().email().nullable().optional(),
    address: z.string().trim().max(300).nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const user = await requireAuth(request);
  const { id } = await context.params;
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid supplier details." }, { status: 400 });
  }

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ message: "Supplier not found." }, { status: 404 });
  }

  const data = {
    ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
    ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone || null } : {}),
    ...(parsed.data.email !== undefined ? { email: parsed.data.email || null } : {}),
    ...(parsed.data.address !== undefined ? { address: parsed.data.address || null } : {}),
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes || null } : {}),
    ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
  };

  const supplier = await prisma.$transaction(async (tx) => {
    const updated = await tx.supplier.update({ where: { id }, data });

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: updated.isActive ? "SUPPLIER_UPDATED" : "SUPPLIER_DEACTIVATED",
        entityType: "Supplier",
        entityId: updated.id,
        beforeData: {
          name: existing.name,
          phone: existing.phone,
          email: existing.email,
          address: existing.address,
          notes: existing.notes,
          isActive: existing.isActive,
        },
        afterData: {
          name: updated.name,
          phone: updated.phone,
          email: updated.email,
          address: updated.address,
          notes: updated.notes,
          isActive: updated.isActive,
        },
      },
    });

    return updated;
  });

  return NextResponse.json({ supplier });
}
