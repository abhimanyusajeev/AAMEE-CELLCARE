import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";

const Schema = z.object({ name: z.string().trim().min(1).max(100), purchasePrice: z.number().nonnegative(), sellingPrice: z.number().nonnegative(), discount: z.number().nonnegative().default(0), unit: z.string().trim().min(1).max(20).default("PCS"), reorderLevel: z.number().int().nonnegative().default(0), warrantyName: z.string().trim().max(100).optional().or(z.literal("")), warrantyDays: z.number().int().nonnegative().optional() });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(request); const { id } = await context.params; const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid variant details.", issues: parsed.error.flatten() }, { status: 400 });
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, isActive: true } });
  if (!product) return NextResponse.json({ message: "Product not found." }, { status: 404 });
  const d = parsed.data;
  const created = await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.create({
      data: {
        productId: id,
        name: d.name,
        purchasePrice: d.purchasePrice,
        sellingPrice: d.sellingPrice,
        discount: d.discount,
        unit: d.unit,
        reorderLevel: d.reorderLevel,
      },
    });

    if (d.warrantyName && d.warrantyDays && d.warrantyDays > 0) {
      await tx.warrantyPolicy.create({
        data: {
          productVariantId: variant.id,
          name: d.warrantyName,
          durationDays: d.warrantyDays,
        },
      });
    }

    return { variantId: variant.id };
  });

  const variant = await prisma.productVariant.findUnique({
    where: { id: created.variantId },
    include: { warrantyPolicies: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "PRODUCT_VARIANT_CREATED",
      entityType: "ProductVariant",
      entityId: created.variantId,
      metadata: { productId: id },
    },
  });

  return NextResponse.json({ variant }, { status: 201 });
}
