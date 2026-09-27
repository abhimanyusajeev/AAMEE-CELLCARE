import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { z } from "zod";

const Schema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(80).optional().nullable(),
  brand: z.string().trim().max(100).optional().nullable(),
  categoryId: z.string().min(1),
  productType: z.enum(["MOBILE", "ACCESSORY", "SPARE_PART", "SERVICE"]),
  variantId: z.string().min(1),
  variantName: z.string().trim().min(1).max(100),
  purchasePrice: z.coerce.number().finite().nonnegative(),
  sellingPrice: z.coerce.number().finite().nonnegative(),
  reorderLevel: z.coerce.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await requireAuth(_request);
  const { id } = await context.params;
  const product = await prisma.product.findUnique({ where: { id }, include: { category: true, variants: true } });
  if (!product) return NextResponse.json({ message: "Product not found" }, { status: 404 });
  return NextResponse.json({ product });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await requireAuth(request);
  const { id } = await context.params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid product input" }, { status: 400 });

  try {
    const d = parsed.data;
    const product = await prisma.$transaction(async (tx) => {
      await tx.productVariant.update({ where: { id: d.variantId }, data: { name: d.variantName, purchasePrice: d.purchasePrice, sellingPrice: d.sellingPrice, reorderLevel: d.reorderLevel } });
      return tx.product.update({ where: { id }, data: { name: d.name, sku: d.sku, barcode: d.barcode || null, brand: d.brand || null, categoryId: d.categoryId, productType: d.productType, isActive: d.isActive }, include: { category: true, variants: true } });
    });
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to update product" }, { status: 400 });
  }
}
