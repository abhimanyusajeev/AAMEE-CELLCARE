import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, requireAuth, requireBranchAccess } from "@/lib/auth/session";

const Schema = z.object({
  branchId: z.string().min(1),
  productVariantId: z.string().min(1),
  delta: z.number().int().refine((v) => v !== 0, "Delta cannot be zero"),
  note: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid inventory adjustment.", issues: parsed.error.flatten() }, { status: 400 });
  const { branchId, productVariantId, delta, note } = parsed.data;
  try {
    await requireBranchAccess(user.id, user.role, branchId);
    const variant = await prisma.productVariant.findUnique({ where: { id: productVariantId }, include: { product: true } });
    if (!variant || !variant.isActive || !variant.product.isActive) return NextResponse.json({ message: "Product variant not found." }, { status: 404 });
    if (variant.product.productType === "MOBILE") return NextResponse.json({ message: "Mobile stock must be added or moved using IMEI/serial devices." }, { status: 400 });
    if (variant.product.productType === "SERVICE") return NextResponse.json({ message: "Service items do not have inventory." }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.findUnique({ where: { productVariantId_branchId: { productVariantId, branchId } } });
      const currentQty = current?.quantity ?? 0;
      const nextQty = currentQty + delta;
      if (nextQty < 0) throw new Error("INSUFFICIENT_STOCK");
      const inventory = await tx.inventoryItem.upsert({
        where: { productVariantId_branchId: { productVariantId, branchId } },
        update: { quantity: nextQty, reorderLevel: variant.reorderLevel },
        create: { branchId, productVariantId, quantity: nextQty, reorderLevel: variant.reorderLevel },
      });
      await tx.stockMovement.create({ data: { branchId, productVariantId, quantity: delta, type: "MANUAL_ADJUSTMENT", note: note || null, createdById: user.id } });
      await tx.auditLog.create({ data: { branchId, actorId: user.id, action: "INVENTORY_ADJUSTED", entityType: "InventoryItem", entityId: inventory.id, metadata: { delta, previousQuantity: currentQty, newQuantity: nextQty, note: note || null } } });
      return inventory;
    });
    return NextResponse.json({ inventory: result });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") return NextResponse.json({ message: "Insufficient stock." }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to adjust inventory." }, { status: 500 });
  }
}
