import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { CustomerDetailManager } from "@/components/management/CustomerDetailManager";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;
  const branchIds = user.role === "OWNER"
    ? null
    : (await prisma.userBranchAssignment.findMany({ where: { userId: user.id }, select: { branchId: true } })).map((x) => x.branchId);

  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      sales: { where: branchIds ? { branchId: { in: branchIds } } : undefined, orderBy: { createdAt: "desc" }, take: 20, include: { invoice: true, branch: true } },
      repairs: { where: branchIds ? { branchId: { in: branchIds } } : undefined, orderBy: { createdAt: "desc" }, take: 20, include: { branch: true } },
      visits: { where: branchIds ? { branchId: { in: branchIds } } : undefined, orderBy: { visitedAt: "desc" }, take: 50, include: { branch: true, createdBy: { select: { name: true } } } },
    },
  });
  if (!c) notFound();

  const branches = user.role === "OWNER"
    ? await prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
    : await prisma.branch.findMany({ where: { id: { in: branchIds ?? [] }, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });

  return <div><div className="mb-5"><Link href="/customers" className="text-sm text-blue-700">← Customers</Link></div><CustomerDetailManager customer={{ id:c.id,name:c.name,phone:c.phone,alternatePhone:c.alternatePhone,email:c.email,address:c.address,notes:c.notes }} sales={c.sales.map(s=>({id:s.id,invoiceNumber:s.invoice?.invoiceNumber??s.id,total:Number(s.total),branch:s.branch.name,createdAt:s.createdAt.toISOString()}))} repairs={c.repairs.map(r=>({id:r.id,ticketNumber:r.ticketNumber,deviceType:r.deviceType,issue:r.issue,status:r.status,branch:r.branch.name,createdAt:r.createdAt.toISOString()}))} visits={c.visits.map(v=>({id:v.id,type:v.type,note:v.note,branch:v.branch.name,createdBy:v.createdBy.name,visitedAt:v.visitedAt.toISOString()}))} branches={branches}/></div>;
}
