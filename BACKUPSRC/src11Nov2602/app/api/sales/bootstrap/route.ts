import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const [products, customers, branches] = await Promise.all([
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          sku: true,
          productType: true,
          variants: {
            where: { isActive: true },
            select: { id: true, name: true, sellingPrice: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { name: "asc" },
        take: 500,
      }),
      prisma.customer.findMany({
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
        take: 500,
      }),
      user.role === "OWNER"
        ? prisma.branch.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          })
        : prisma.branch.findMany({
            where: { isActive: true, assignments: { some: { userId: user.id } } },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
          }),
    ]);

    return NextResponse.json({ products, customers, branches });
  } catch (error) {
    console.error("GET /api/sales/bootstrap error:", error);
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to load POS data" }, { status: 500 });
  }
}
