import { requireOwnerPage } from "@/lib/auth/page-guards";
import { prisma } from "@/lib/db/prisma";
import { BranchManager } from "@/components/management/BranchManager";

export default async function Page() {
  await requireOwnerPage();
  const branches = await prisma.branch.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return <BranchManager initialBranches={branches.map((branch) => ({ ...branch, createdAt: branch.createdAt.toISOString() }))} />;
}
