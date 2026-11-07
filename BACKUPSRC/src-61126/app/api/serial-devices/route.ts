import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, requireAuth, requireBranchAccess } from "@/lib/auth/session";

const Schema = z.object({
  branchId: z.string().min(1), productVariantId: z.string().min(1), imei1: z.string().trim().min(5).max(30), imei2: z.string().trim().max(30).optional().or(z.literal("")),
  serialNumber: z.string().trim().max(100).optional().or(z.literal("")), ram: z.string().trim().max(50).optional().or(z.literal("")), storage: z.string().trim().max(50).optional().or(z.literal("")), color: z.string().trim().max(50).optional().or(z.literal("")), warrantyText: z.string().trim().max(300).optional().or(z.literal("")), purchasePrice: z.number().nonnegative().optional(), salePrice: z.number().nonnegative().optional(),
});

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  const branchId = request.nextUrl.searchParams.get("branchId"); const variantId = request.nextUrl.searchParams.get("productVariantId");
  if (!branchId || !variantId) return NextResponse.json({ message: "branchId and productVariantId are required" }, { status: 400 });
  const devices = await prisma.serialDevice.findMany({
    where: {
      branchId,
      productVariantId: variantId,
      status: "AVAILABLE",
      branch: user.role === "OWNER"
        ? { isActive: true }
        : { isActive: true, assignments: { some: { userId: user.id } } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      imei1: true,
      imei2: true,
      serialNumber: true,
      color: true,
      storage: true,
      ram: true,
      status: true,
      purchasePrice: true,
      salePrice: true,
    },
  });
  return NextResponse.json({ devices });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request); const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid serial device details.", issues: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  try {
    await requireBranchAccess(user.id, user.role, d.branchId);
    const variant = await prisma.productVariant.findUnique({ where: { id: d.productVariantId }, include: { product: true } });
    if (!variant || !variant.isActive || !variant.product.isActive) return NextResponse.json({ message: "Product variant not found." }, { status: 404 });
    if (variant.product.productType !== "MOBILE") return NextResponse.json({ message: "IMEI/serial tracking is currently enabled for mobile products." }, { status: 400 });
    const device = await prisma.$transaction(async (tx) => {
      const created = await tx.serialDevice.create({ data: { branchId: d.branchId, productVariantId: d.productVariantId, imei1: d.imei1, imei2: d.imei2 || null, serialNumber: d.serialNumber || null, ram: d.ram || null, storage: d.storage || null, color: d.color || null, warrantyText: d.warrantyText || null, purchasePrice: d.purchasePrice ?? variant.purchasePrice, salePrice: d.salePrice ?? variant.sellingPrice } });
      await tx.inventoryItem.upsert({ where: { productVariantId_branchId: { productVariantId: d.productVariantId, branchId: d.branchId } }, update: { quantity: { increment: 1 }, reorderLevel: variant.reorderLevel }, create: { branchId: d.branchId, productVariantId: d.productVariantId, quantity: 1, reorderLevel: variant.reorderLevel } });
      await tx.stockMovement.create({ data: { branchId: d.branchId, productVariantId: d.productVariantId, quantity: 1, type: "OPENING_STOCK", referenceType: "SERIAL_DEVICE", referenceId: created.id, note: "Serialized device added to stock", createdById: user.id } });
      await tx.auditLog.create({ data: { branchId: d.branchId, actorId: user.id, action: "SERIAL_DEVICE_ADDED", entityType: "SerialDevice", entityId: created.id, metadata: { imei1: d.imei1, imei2: d.imei2 || null, serialNumber: d.serialNumber || null } } });
      return created;
    });
    return NextResponse.json({ device }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002") return NextResponse.json({ message: "IMEI already exists." }, { status: 409 });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to add serial device." }, { status: 500 });
  }
}
