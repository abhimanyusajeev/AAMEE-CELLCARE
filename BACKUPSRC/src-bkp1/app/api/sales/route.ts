import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";

const ItemSchema = z.object({
  productVariantId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  serialDeviceIds: z.array(z.string().min(1)).default([]),
});

const Schema = z.object({
  branchId: z.string().min(1),
  customerId: z.string().optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(ItemSchema).min(1),
  payment: z.object({
    method: z.enum(["CASH", "UPI", "BANK_TRANSFER", "BAJAJ_EMI"]),
    amount: z.number().nonnegative(),
    reference: z.string().max(160).optional(),
    emi: z.object({
      provider: z.string().trim().min(2),
      applicationReference: z.string().max(100).optional(),
      tenureMonths: z.number().int().positive().optional(),
      emiAmount: z.number().positive().optional(),
    }).optional(),
  }),
});

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  const sales = await prisma.sale.findMany({
    where: {
      branch: user.role === "OWNER"
        ? { isActive: true }
        : { isActive: true, assignments: { some: { userId: user.id } } },
    },
    include: {
      invoice: true,
      customer: true,
      branch: true,
      createdBy: { select: { name: true } },
      items: { include: { productVariant: { include: { product: true } }, serialDevice: true } },
      payments: true,
      emiTransaction: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ sales });
}

export async function POST(request: NextRequest) {
  const user = await requireAuth(request);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid sale", issues: parsed.error.flatten() }, { status: 400 });
  try {
    const variantIds = [...new Set(parsed.data.items.map((item) => item.productVariantId))];
    const serialIds = parsed.data.items.flatMap((item) => item.serialDeviceIds);

    // Perform read-heavy validation before the interactive transaction. This is the
    // same protection used by the purchase workflow: remote PostgreSQL should not
    // spend the transaction timeout on validation queries.
    const [customer, variants, inventoryRows, serialDevices, branch] = await Promise.all([
      parsed.data.customerId
        ? prisma.customer.findUnique({ where: { id: parsed.data.customerId }, select: { id: true } })
        : Promise.resolve(null),
      prisma.productVariant.findMany({
        where: { id: { in: variantIds }, isActive: true },
        select: { id: true, productId: true, sellingPrice: true, product: { select: { name: true, productType: true } } },
      }),
      prisma.inventoryItem.findMany({
        where: { branchId: parsed.data.branchId, productVariantId: { in: variantIds } },
        select: { productVariantId: true, quantity: true },
      }),
      serialIds.length
        ? prisma.serialDevice.findMany({
            where: { id: { in: serialIds } },
            select: { id: true, branchId: true, productVariantId: true, status: true, soldSaleId: true },
          })
        : Promise.resolve([]),
      prisma.branch.findFirst({
        where:
          user.role === "OWNER"
            ? { id: parsed.data.branchId, isActive: true }
            : { id: parsed.data.branchId, isActive: true, assignments: { some: { userId: user.id } } },
        select: { id: true, invoicePrefix: true },
      }),
    ]);

    if (parsed.data.customerId && !customer) throw new Error("Customer not found");
    if (!branch) throw new Error("Branch not found");

    const variantMap = new Map(variants.map((v) => [v.id, v]));
    const inventoryMap = new Map(inventoryRows.map((i) => [i.productVariantId, i.quantity]));
    const serialMap = new Map(serialDevices.map((d) => [d.id, d]));

    if (variants.length !== variantIds.length) throw new Error("One or more product variants are invalid or inactive");
    if (new Set(serialIds).size !== serialIds.length) throw new Error("The same IMEI/device cannot be selected twice");

    let subtotal = new Prisma.Decimal(0);
    for (const item of parsed.data.items) {
      const variant = variantMap.get(item.productVariantId)!;
      const available = inventoryMap.get(item.productVariantId) ?? 0;
      if (available < item.quantity) throw new Error(`Insufficient stock for ${variant.product.name}`);

      if (variant.product.productType === "MOBILE") {
        if (item.quantity !== item.serialDeviceIds.length) {
          throw new Error(`Select one available IMEI for every unit of ${variant.product.name}`);
        }
      } else if (item.serialDeviceIds.length > 0) {
        throw new Error("IMEIs are only allowed for mobile products");
      }

      for (const serialId of item.serialDeviceIds) {
        const device = serialMap.get(serialId);
        if (!device || device.branchId !== parsed.data.branchId || device.productVariantId !== item.productVariantId || device.status !== "AVAILABLE") {
          throw new Error("One or more selected IMEIs are unavailable");
        }
      }

      subtotal = subtotal.add(new Prisma.Decimal(item.unitPrice).mul(item.quantity));
    }

    const paymentAmount = new Prisma.Decimal(parsed.data.payment.amount);
    if (!paymentAmount.eq(subtotal)) {
      throw new Error("Credit/partial payment is disabled. Payment must equal the bill total.");
    }

    if (parsed.data.payment.method === "BAJAJ_EMI") {
      if (!parsed.data.customerId) throw new Error("Bajaj EMI requires a customer");
      if (!parsed.data.payment.emi) throw new Error("EMI details are required");
      if (parsed.data.items.length !== 1 || parsed.data.items[0].quantity !== 1 || parsed.data.items[0].serialDeviceIds.length !== 1) {
        throw new Error("Bajaj EMI must be linked to exactly one IMEI-tracked device");
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          branchId: parsed.data.branchId,
          customerId: parsed.data.customerId,
          createdById: user.id,
          subtotal,
          total: subtotal,
          notes: parsed.data.notes || null,
          items: {
            create: parsed.data.items.flatMap((item) => {
              if (item.serialDeviceIds.length === 0) {
                return [{ productVariantId: item.productVariantId, quantity: item.quantity, unitPrice: item.unitPrice, discountAmount: 0, taxAmount: 0 }];
              }
              return item.serialDeviceIds.map((serialDeviceId) => ({
                productVariantId: item.productVariantId,
                serialDeviceId,
                quantity: 1,
                unitPrice: item.unitPrice,
                discountAmount: 0,
                taxAmount: 0,
              }));
            }),
          },
        },
        include: { items: true },
      });

      // Avoid the previous MAX/last-invoice lookup inside the transaction. The
      // sale id is already globally unique, so using its suffix gives us a
      // branch-prefixed, collision-resistant invoice number without an extra
      // round trip or race between concurrent sales.
      const invoiceNumber = `${branch.invoicePrefix}-${sale.id.slice(-8).toUpperCase()}`;
      const invoice = await tx.invoice.create({
        data: {
          branchId: parsed.data.branchId,
          saleId: sale.id,
          invoiceNumber,
          status: "ISSUED",
        },
      });

      const payment = await tx.payment.create({
        data: {
          branchId: parsed.data.branchId,
          saleId: sale.id,
          amount: paymentAmount,
          method: parsed.data.payment.method,
          reference: parsed.data.payment.reference || null,
          status: "COMPLETED",
          paidAt: new Date(),
        },
      });

      const quantitiesByVariant = new Map<string, number>();
      for (const item of parsed.data.items) quantitiesByVariant.set(item.productVariantId, (quantitiesByVariant.get(item.productVariantId) ?? 0) + item.quantity);

      // Keep the atomic section small: inventory decrements are mandatory, while
      // the movement ledger can be inserted in one batch.
      for (const [productVariantId, quantity] of quantitiesByVariant) {
        await tx.inventoryItem.update({
          where: { productVariantId_branchId: { productVariantId, branchId: parsed.data.branchId } },
          data: { quantity: { decrement: quantity } },
        });
      }
      await tx.stockMovement.createMany({
        data: [...quantitiesByVariant.entries()].map(([productVariantId, quantity]) => ({
          branchId: parsed.data.branchId, productVariantId, quantity, type: "SALE" as const,
          referenceType: "SALE", referenceId: sale.id, createdById: user.id,
        })),
      });

      // Group serial updates by sale price so Prisma can update in batches.
      for (const item of parsed.data.items.filter((i) => i.serialDeviceIds.length)) {
        await tx.serialDevice.updateMany({
          where: { id: { in: item.serialDeviceIds }, status: "AVAILABLE", branchId: parsed.data.branchId },
          data: { status: "SOLD", soldSaleId: sale.id, soldAt: new Date(), salePrice: item.unitPrice },
        });
      }

      if (parsed.data.payment.method === "BAJAJ_EMI") {
        const emi = parsed.data.payment.emi!;
        await tx.eMITransaction.create({
          data: {
            branchId: parsed.data.branchId,
            saleId: sale.id,
            paymentId: payment.id,
            customerId: parsed.data.customerId!,
            serialDeviceId: serialIds[0],
            provider: emi.provider,
            applicationReference: emi.applicationReference,
            financedAmount: paymentAmount,
            tenureMonths: emi.tenureMonths,
            emiAmount: emi.emiAmount,
            status: "SUBMITTED",
          },
        });
      }

      return { sale, invoice };
    }, { maxWait: 10000, timeout: 20000 });

    // These are non-critical post-commit side effects. Schedule them after the
    // response work so the customer is not forced to wait for three additional
    // Neon round trips after the atomic sale has already committed.
    after(async () => {
      await Promise.allSettled([
        parsed.data.customerId
          ? prisma.customerVisit.create({ data: { customerId: parsed.data.customerId, branchId: parsed.data.branchId, type: "SALE", createdById: user.id } })
          : Promise.resolve(),
        prisma.transaction.create({ data: { branchId: parsed.data.branchId, type: "SALE", referenceId: result.sale.id, referenceNo: result.invoice.invoiceNumber, amount: subtotal } }),
        prisma.auditLog.create({ data: {
          branchId: parsed.data.branchId, actorId: user.id, action: "CREATE", entityType: "SALE", entityId: result.sale.id,
          metadata: { invoiceNumber: result.invoice.invoiceNumber, paymentMethod: parsed.data.payment.method },
        } }),
      ]);
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to complete sale" }, { status: 400 });
  }
}
