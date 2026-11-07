import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireBranchAccess } from "@/lib/auth/session";
import { z } from "zod";

const ReturnSchema = z.object({
  branchId: z.string(),
  saleId: z.string(),
  reason: z.string().max(1000).optional(),
  items: z.array(
    z.object({
      saleItemId: z.string(),
      quantity: z.number().int().positive(),
      refundAmount: z.number().nonnegative(),
    }),
  ).min(1),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const returns = await prisma.saleReturn.findMany({
      where: {
        branch: user.role === "OWNER"
          ? { isActive: true }
          : { isActive: true, assignments: { some: { userId: user.id } } },
      },
      include: {
        sale: { include: { invoice: true, customer: true } },
        items: { include: { saleItem: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ returns });
  } catch (error) {
    console.error("GET /api/returns error:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to load returns" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const parsed = ReturnSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: "Invalid return", issues: parsed.error.flatten() }, { status: 400 });
    }

    await requireBranchAccess(user.id, user.role, parsed.data.branchId);

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: parsed.data.saleId },
        include: { customer: true, items: { include: { serialDevice: true } } },
      });

      if (!sale || sale.branchId !== parsed.data.branchId) throw new Error("Sale not found");
      if (sale.status === "CANCELLED") throw new Error("Cancelled sale cannot be returned");

      const returnedBySaleItem = new Map<string, number>();
      const existingReturns = await tx.saleReturnItem.findMany({
        where: { saleItem: { saleId: sale.id }, saleReturn: { status: { in: ["COMPLETED", "APPROVED"] } } },
        select: { saleItemId: true, quantity: true },
      });
      for (const item of existingReturns) {
        returnedBySaleItem.set(item.saleItemId, (returnedBySaleItem.get(item.saleItemId) ?? 0) + item.quantity);
      }

      let refundAmount = 0;
      for (const item of parsed.data.items) {
        const saleItem = sale.items.find((candidate) => candidate.id === item.saleItemId);
        if (!saleItem) throw new Error("Sale item not found");
        const alreadyReturned = returnedBySaleItem.get(item.saleItemId) ?? 0;
        if (alreadyReturned + item.quantity > saleItem.quantity) {
          throw new Error(`Return quantity exceeds remaining quantity for sale item ${item.saleItemId}`);
        }
        refundAmount += item.refundAmount;
      }

      const saleReturn = await tx.saleReturn.create({
        data: {
          branchId: parsed.data.branchId,
          saleId: parsed.data.saleId,
          customerId: sale.customerId,
          reason: parsed.data.reason || null,
          refundAmount,
          status: "COMPLETED",
          processedAt: new Date(),
          items: {
            create: parsed.data.items.map((item) => ({
              saleItemId: item.saleItemId,
              quantity: item.quantity,
              refundAmount: item.refundAmount,
            })),
          },
        },
      });

      for (const item of parsed.data.items) {
        const saleItem = sale.items.find((candidate) => candidate.id === item.saleItemId)!;

        await tx.inventoryItem.update({
          where: {
            productVariantId_branchId: {
              productVariantId: saleItem.productVariantId,
              branchId: parsed.data.branchId,
            },
          },
          data: { quantity: { increment: item.quantity } },
        });

        if (saleItem.serialDeviceId) {
          await tx.serialDevice.update({
            where: { id: saleItem.serialDeviceId },
            data: { status: "RETURNED", soldSaleId: null, soldAt: null },
          });
        }

        await tx.stockMovement.create({
          data: {
            branchId: parsed.data.branchId,
            productVariantId: saleItem.productVariantId,
            quantity: item.quantity,
            type: "SALE_RETURN",
            referenceType: "SALE_RETURN",
            referenceId: saleReturn.id,
            createdById: user.id,
          },
        });
      }

      const totalReturned = new Map(returnedBySaleItem);
      for (const item of parsed.data.items) {
        totalReturned.set(item.saleItemId, (totalReturned.get(item.saleItemId) ?? 0) + item.quantity);
      }
      const fullyReturned = sale.items.every((item) => (totalReturned.get(item.id) ?? 0) >= item.quantity);

      await tx.sale.update({
        where: { id: sale.id },
        data: { status: fullyReturned ? "RETURNED" : "PARTIALLY_RETURNED" },
      });

      return saleReturn;
    }, { maxWait: 10000, timeout: 20000 });

    await Promise.allSettled([
      prisma.transaction.create({ data: { branchId: parsed.data.branchId, type: "SALE_RETURN", referenceId: result.id, amount: result.refundAmount } }),
      prisma.auditLog.create({ data: { branchId: parsed.data.branchId, actorId: user.id, action: "CREATE", entityType: "SALE_RETURN", entityId: result.id, metadata: { saleId: parsed.data.saleId } } }),
    ]);

    return NextResponse.json({ return: result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/returns error:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to process return" }, { status: 400 });
  }
}
