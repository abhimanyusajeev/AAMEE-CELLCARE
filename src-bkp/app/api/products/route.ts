import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { z } from "zod";

const Schema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(80),
  barcode: z.string().trim().max(80).optional(),
  brand: z.string().trim().max(100).optional(),
  categoryId: z.string().optional(),
  categoryName: z.string().trim().max(80).optional(),
  productType: z.enum(["MOBILE", "ACCESSORY", "SPARE_PART", "SERVICE"]),
  variantName: z.string().trim().min(1).max(100),
  purchasePrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  reorderLevel: z.number().int().nonnegative().default(0),
  warrantyName: z.string().trim().max(100).optional().or(z.literal("")),
  warrantyDays: z.number().int().nonnegative().optional(),
});

export async function GET() {
  await requireAuth();
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      brand: true,
      productType: true,
      category: { select: { id: true, name: true, slug: true } },
      variants: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          purchasePrice: true,
          sellingPrice: true,
          discount: true,
          unit: true,
          reorderLevel: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
    take: 500,
  });
  return NextResponse.json({ products });
}

export async function POST(request: NextRequest) {
  await requireAuth(request);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid product input", issues: parsed.error.flatten() }, { status: 400 });

  try {
    const data = parsed.data;
    let categoryId = data.categoryId;
    if (!categoryId && data.categoryName) {
      const slug = data.categoryName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const category = await prisma.category.upsert({ where: { slug }, update: { isActive: true }, create: { name: data.categoryName, slug } });
      categoryId = category.id;
    }
    if (!categoryId) return NextResponse.json({ message: "Category is required" }, { status: 400 });

    // Keep the interactive transaction short. Do not run a second read query
    // inside the transaction; Prisma's default interactive transaction timeout
    // is 5 seconds and cloud PostgreSQL latency can make that read exceed it.
    const created = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: data.name,
          sku: data.sku,
          barcode: data.barcode || null,
          brand: data.brand || null,
          categoryId,
          productType: data.productType,
          variants: {
            create: {
              name: data.variantName,
              purchasePrice: data.purchasePrice,
              sellingPrice: data.sellingPrice,
              reorderLevel: data.reorderLevel,
            },
          },
        },
        include: { category: true, variants: true },
      });

      const variant = product.variants[0];
      if (data.warrantyName && data.warrantyDays && data.warrantyDays > 0) {
        await tx.warrantyPolicy.create({
          data: {
            productVariantId: variant.id,
            name: data.warrantyName,
            durationDays: data.warrantyDays,
          },
        });
      }

      return { productId: product.id };
    });

    // Read the final representation outside the transaction. This avoids
    // holding the transaction open while Prisma performs another SELECT.
    const product = await prisma.product.findUnique({
      where: { id: created.productId },
      include: {
        category: true,
        variants: { include: { warrantyPolicies: true } },
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to create product" }, { status: 400 });
  }
}
