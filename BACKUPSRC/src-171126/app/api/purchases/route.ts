import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireBranchAccess } from "@/lib/auth/session";
import { z } from "zod";

const ItemSchema = z.object({
  productVariantId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  imeis: z.array(z.string().trim().min(5).max(40)).default([]),
});
const Schema = z.object({
  branchId: z.string().min(1),
  supplierId: z.string().min(1),
  invoiceNumber: z.string().trim().max(100).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(ItemSchema).min(1),
});

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  const branchIds = user.role === "OWNER"
    ? (await prisma.branch.findMany({ where: { isActive: true }, select: { id: true } })).map((b) => b.id)
    : (await prisma.userBranchAssignment.findMany({ where: { userId: user.id, branch: { isActive: true } }, select: { branchId: true } })).map((b) => b.branchId);
  const purchases = await prisma.purchase.findMany({ where: { branchId: { in: branchIds } }, include: { branch: true, supplier: true, items: { include: { productVariant: { include: { product: true } } } } }, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({ purchases });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid purchase", issues: parsed.error.flatten() }, { status: 400 });
  await requireBranchAccess(user.id, user.role, parsed.data.branchId);

  try {
    // Validate the relatively expensive/read-only data before opening the interactive
    // transaction. This keeps the transaction focused on atomic writes and avoids
    // Prisma's default 5-second interactive transaction timeout on remote Postgres.
    const [supplier, variants] = await Promise.all([
      prisma.supplier.findFirst({
        where: { id: parsed.data.supplierId, isActive: true },
        select: { id: true },
      }),
      prisma.productVariant.findMany({
        where: {
          id: { in: parsed.data.items.map((item) => item.productVariantId) },
          isActive: true,
        },
        select: {
          id: true,
          reorderLevel: true,
          product: { select: { productType: true } },
        },
      }),
    ]);

    if (!supplier) throw new Error("Supplier not found");

    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
    let subtotal = new Prisma.Decimal(0);

    for (const item of parsed.data.items) {
      const variant = variantMap.get(item.productVariantId);
      if (!variant) throw new Error("Product variant not found");

      if (
        variant.product.productType === "MOBILE" &&
        item.imeis.length > 0 &&
        item.imeis.length !== item.quantity
      ) {
        throw new Error("IMEI count must match mobile quantity");
      }

      if (variant.product.productType !== "MOBILE" && item.imeis.length > 0) {
        throw new Error("IMEIs are only allowed for mobile products");
      }

      subtotal = subtotal.add(
        new Prisma.Decimal(item.unitPrice).mul(item.quantity)
      );
    }

    // Prevent duplicate IMEIs in the same request before entering the transaction.
    const requestImeis = parsed.data.items.flatMap((item) => item.imeis);
    if (new Set(requestImeis).size !== requestImeis.length) {
      throw new Error("Duplicate IMEI in purchase request");
    }

    // Keep the transaction short: only atomic writes happen here. The longer timeout
    // is an additional safety net for hosted/remote PostgreSQL latency.
    const result = await prisma.$transaction(
      async (tx) => {
        const purchase = await tx.purchase.create({
          data: {
            branchId: parsed.data.branchId,
            supplierId: parsed.data.supplierId,
            invoiceNumber: parsed.data.invoiceNumber || null,
            subtotal,
            total: subtotal,
            notes: parsed.data.notes || null,
            createdById: user.id,
            items: {
              create: parsed.data.items.map((item) => ({
                productVariantId: item.productVariantId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
              })),
            },
          },
          include: { items: true },
        });

        // Aggregate repeated variants so each inventory row is updated once.
        const quantitiesByVariant = new Map<string, number>();
        for (const item of parsed.data.items) {
          quantitiesByVariant.set(
            item.productVariantId,
            (quantitiesByVariant.get(item.productVariantId) ?? 0) + item.quantity
          );
        }

        for (const [productVariantId, quantity] of quantitiesByVariant) {
          const variant = variantMap.get(productVariantId)!;

          await tx.inventoryItem.upsert({
            where: {
              productVariantId_branchId: {
                productVariantId,
                branchId: parsed.data.branchId,
              },
            },
            update: { quantity: { increment: quantity } },
            create: {
              productVariantId,
              branchId: parsed.data.branchId,
              quantity,
              reorderLevel: variant.reorderLevel,
            },
          });

          await tx.stockMovement.create({
            data: {
              branchId: parsed.data.branchId,
              productVariantId,
              quantity,
              type: "PURCHASE",
              referenceType: "PURCHASE",
              referenceId: purchase.id,
              createdById: user.id,
            },
          });
        }

        const serialRows = parsed.data.items.flatMap((item) =>
          item.imeis.map((imei1) => ({
            branchId: parsed.data.branchId,
            productVariantId: item.productVariantId,
            imei1,
            purchasePrice: item.unitPrice,
          }))
        );

        if (serialRows.length > 0) {
          await tx.serialDevice.createMany({
            data: serialRows,
            skipDuplicates: false,
          });
        }

        await tx.transaction.create({
          data: {
            branchId: parsed.data.branchId,
            type: "PURCHASE",
            referenceId: purchase.id,
            referenceNo: parsed.data.invoiceNumber || undefined,
            amount: subtotal,
          },
        });

        return purchase;
      },
      {
        timeout: 15000,
      }
    );

    return NextResponse.json({ purchase: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to record purchase" },
      { status: 400 }
    );
  }
}
