import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { SupplierManager } from "@/components/management/SupplierManager";

export default async function SuppliersPage() {
  await requireAuth();

  const suppliers = await prisma.supplier.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { purchases: true } } },
  });

  return (
    <SupplierManager
      initialSuppliers={suppliers.map((supplier) => ({
        id: supplier.id,
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        address: supplier.address,
        notes: supplier.notes,
        isActive: supplier.isActive,
        createdAt: supplier.createdAt.toISOString(),
        updatedAt: supplier.updatedAt.toISOString(),
        purchaseCount: supplier._count.purchases,
      }))}
    />
  );
}
