import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireBranchAccess } from "@/lib/auth/session";
import { RepairDetail } from "./RepairDetail";

export default async function RepairDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;
  const repair = await prisma.repairJob.findUnique({
    where: { id },
    include: {
      branch: true,
      customer: true,
      technician: true,
      device: true,
      parts: { include: { productVariant: { include: { product: true } } } },
      inspections: { orderBy: { item: "asc" } },
      accessories: { orderBy: { createdAt: "asc" } },
      statusHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { changedAt: "asc" } },
      payments: { orderBy: { paidAt: "desc" } },
      invoice: true,
    },
  });
  if (!repair) notFound();
  await requireBranchAccess(user.id, user.role, repair.branchId);
  const technicians = await prisma.user.findMany({
    where: { isActive: true, OR: [{ role: "OWNER" }, { role: "EMPLOYEE", branchAssignments: { some: { branchId: repair.branchId } } }] },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  const products = await prisma.product.findMany({
    where: { isActive: true, productType: "SPARE_PART" },
    select: { id: true, name: true, brand: true, variants: { where: { isActive: true }, select: { id: true, name: true, sellingPrice: true } } },
    orderBy: { name: "asc" }, take: 300,
  });
  return <div className="space-y-4"><Link href="/repairs" className="inline-flex text-sm font-semibold text-blue-700">← Back to Repair Jobs</Link><RepairDetail repair={JSON.parse(JSON.stringify(repair))} technicians={technicians} products={JSON.parse(JSON.stringify(products))} /></div>;
}
