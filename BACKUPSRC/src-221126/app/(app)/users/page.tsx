import { requireOwnerPage } from "@/lib/auth/page-guards";
import { prisma } from "@/lib/db/prisma";
import { UserManager } from "@/components/management/UserManager";

export default async function Page() {
  const owner = await requireOwnerPage();
  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, email: true, phone: true, role: true, isActive: true,
        branchAssignments: { include: { branch: { select: { id: true, name: true, code: true } } } },
      },
    }),
    prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
  ]);
  return <UserManager currentUserId={owner.id} initialUsers={users} branches={branches} />;
}
