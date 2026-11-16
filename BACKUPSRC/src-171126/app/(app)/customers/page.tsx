import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { CustomerManager } from "@/components/management/CustomerManager";

export default async function Customers() {
  await requireAuth();
  const rows = await prisma.customer.findMany({
    orderBy: { updatedAt: "desc" }, take: 500,
    include: { _count: { select: { sales: true, repairs: true, visits: true } } },
  });
  return <CustomerManager initialCustomers={rows.map((r) => ({ ...r, createdAt:r.createdAt.toISOString(), updatedAt:r.updatedAt.toISOString() }))} />;
}
