import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

/** Resolve the active shop selection for server-rendered pages. The cookie is
 * only a preference; access is always constrained by the signed-in user's role. */
export async function getBranchScope(user: { id: string; role: string }) {
  const cookieStore = await cookies();
  const requested = cookieStore.get("aamee_selected_branch")?.value ?? "ALL";
  const branches = await prisma.branch.findMany({
    where: user.role === "OWNER"
      ? { isActive: true }
      : { isActive: true, assignments: { some: { userId: user.id } } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const selectedBranchId = user.role === "OWNER" && requested !== "ALL" && branches.some(b => b.id === requested)
    ? requested
    : null;
  const selectedBranches = selectedBranchId ? branches.filter(b => b.id === selectedBranchId) : branches;
  return {
    branches,
    selectedBranchId,
    selectedBranches,
    branchIds: selectedBranches.map(b => b.id),
    selectedBranchName: selectedBranchId ? selectedBranches[0]?.name ?? "Selected shop" : "All Shops",
  };
}
