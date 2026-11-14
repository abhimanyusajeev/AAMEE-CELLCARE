import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { StockTransferManager } from "@/components/management/StockTransferManager";

export default async function TransfersPage() {
  const user = await requireAuth();
  const activeBranches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const assigned = user.role === "OWNER"
    ? activeBranches
    : await prisma.branch.findMany({
        where: { isActive: true, assignments: { some: { userId: user.id } } },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });

  const variants = await prisma.productVariant.findMany({
    where: { isActive: true, product: { isActive: true } },
    select: { id: true, name: true, product: { select: { name: true, sku: true, productType: true } } },
    orderBy: { product: { name: "asc" } },
  });

  return (
    <StockTransferManager
      sourceBranches={assigned}
      destinationBranches={activeBranches}
      variants={variants}
      role={user.role}
      userId={user.id}
    />
  );
}
