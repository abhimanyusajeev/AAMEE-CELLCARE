import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, requireAuth, requireBranchAccess } from "@/lib/auth/session";

const ItemSchema = z.object({ productVariantId: z.string().min(1), quantity: z.number().int().positive(), serialDeviceId: z.string().min(1).optional() });
const Schema = z.object({ fromBranchId: z.string().min(1), toBranchId: z.string().min(1), items: z.array(ItemSchema).min(1) });

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  const branches = user.role === "OWNER" ? await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } }) : await prisma.branch.findMany({ where: { isActive: true, assignments: { some: { userId: user.id } } }, select: { id: true } });
  const allowed = new Set(branches.map((b) => b.id));
  const transfers = await prisma.stockTransfer.findMany({ where: { OR: [{ fromBranchId: { in: [...allowed] } }, { toBranchId: { in: [...allowed] } }] }, include: { fromBranch: { select: { id: true, name: true } }, toBranch: { select: { id: true, name: true } }, items: { include: { productVariant: { include: { product: { select: { name: true, sku: true, productType: true } } } }, serialDevice: { select: { id: true, imei1: true, serialNumber: true } } } }, requestedBy: { select: { name: true } } }, orderBy: { requestedAt: "desc" }, take: 100 });
  return NextResponse.json({ transfers });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request); const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid transfer details.", issues: parsed.error.flatten() }, { status: 400 });
  const { fromBranchId, toBranchId, items } = parsed.data;
  if (fromBranchId === toBranchId) return NextResponse.json({ message: "Source and destination branches must be different." }, { status: 400 });
  try {
    await requireBranchAccess(user.id, user.role, fromBranchId);
    // Destination access is intentionally not required for employees: requesting a transfer must not grant operational access to the destination branch.
    const branches = await prisma.branch.findMany({ where: { id: { in: [fromBranchId, toBranchId] }, isActive: true }, select: { id: true } });
    if (branches.length !== 2) return NextResponse.json({ message: "Both branches must be active." }, { status: 400 });
    const variantIds = [...new Set(items.map((i) => i.productVariantId))];
    const variants = await prisma.productVariant.findMany({ where: { id: { in: variantIds }, isActive: true }, include: { product: true } });
    const variantMap = new Map(variants.map((v) => [v.id, v]));
    for (const item of items) {
      const v = variantMap.get(item.productVariantId); if (!v) return NextResponse.json({ message: "Product variant not found." }, { status: 404 });
      if (v.product.productType === "SERVICE") return NextResponse.json({ message: "Service items cannot be transferred." }, { status: 400 });
      if (v.product.productType === "MOBILE" && !item.serialDeviceId) return NextResponse.json({ message: "Mobile transfers must specify an IMEI/serial device." }, { status: 400 });
      if (v.product.productType !== "MOBILE" && item.serialDeviceId) return NextResponse.json({ message: "Serial devices can only be attached to mobile transfers." }, { status: 400 });
      if (item.serialDeviceId) {
        const device = await prisma.serialDevice.findUnique({ where: { id: item.serialDeviceId }, select: { branchId: true, productVariantId: true, status: true } });
        if (!device || device.branchId !== fromBranchId || device.productVariantId !== item.productVariantId || device.status !== "AVAILABLE" || item.quantity !== 1) return NextResponse.json({ message: "Selected serial device is not available in the source branch." }, { status: 409 });
      } else {
        const inv = await prisma.inventoryItem.findUnique({ where: { productVariantId_branchId: { productVariantId: item.productVariantId, branchId: fromBranchId } }, select: { quantity: true } });
        if (!inv || inv.quantity < item.quantity) return NextResponse.json({ message: `Insufficient stock for ${v.product.name}.` }, { status: 409 });
      }
    }
    const transfer = await prisma.stockTransfer.create({ data: { fromBranchId, toBranchId, status: "REQUESTED", requestedById: user.id, items: { create: items.map((i) => ({ productVariantId: i.productVariantId, quantity: i.quantity, serialDeviceId: i.serialDeviceId || null })) } }, include: { items: true, fromBranch: true, toBranch: true } });
    await prisma.auditLog.create({ data: { branchId: fromBranchId, actorId: user.id, action: "STOCK_TRANSFER_REQUESTED", entityType: "StockTransfer", entityId: transfer.id, metadata: { toBranchId, itemCount: items.length } } });
    return NextResponse.json({ transfer }, { status: 201 });
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to create stock transfer." }, { status: 500 });
  }
}
