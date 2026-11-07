import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { format, startOfDay, endOfDay } from "date-fns";

export default async function Dashboard() {
  const user = await requireAuth();
  const cookieStore = await cookies();
  const requestedBranchId = cookieStore.get("aamee_selected_branch")?.value ?? "ALL";

  const branches =
    user.role === "OWNER"
      ? await prisma.branch.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : await prisma.branch.findMany({
          where: {
            isActive: true,
            assignments: { some: { userId: user.id } },
          },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        });

  const accessibleBranchIds = new Set(branches.map((branch) => branch.id));
  const selectedBranchId =
    user.role === "OWNER" &&
    requestedBranchId !== "ALL" &&
    accessibleBranchIds.has(requestedBranchId)
      ? requestedBranchId
      : null;

  const selectedBranches = selectedBranchId
    ? branches.filter((branch) => branch.id === selectedBranchId)
    : branches;

  const branchIds = selectedBranches.map((branch) => branch.id);
  const selectedBranchName = selectedBranchId
    ? selectedBranches[0]?.name ?? "Selected shop"
    : "All Shops";

  const today = new Date();
  const from = startOfDay(today);
  const to = endOfDay(today);

  const [sales, visits, repairs, lowStock] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        branchId: { in: branchIds },
        status: "COMPLETED",
        createdAt: { gte: from, lte: to },
      },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.customerVisit.count({
      where: {
        branchId: { in: branchIds },
        visitedAt: { gte: from, lte: to },
      },
    }),
    prisma.repairJob.count({
      where: {
        branchId: { in: branchIds },
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.inventoryItem.count({
      where: {
        branchId: { in: branchIds },
        OR: [{ quantity: 0 }, { quantity: { lte: 2 } }],
      },
    }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-slate-500">
          {format(today, "EEEE, dd MMM yyyy")}
        </p>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-slate-500">
          Showing today&apos;s operational data for {selectedBranchName}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            "Today's Revenue",
            `₹${Number(sales._sum.total ?? 0).toLocaleString("en-IN")}`,
          ],
          ["Today's Bills", sales._count._all],
          ["Customer Visits", visits],
          ["Repairs Received", repairs],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-3xl font-extrabold text-slate-900">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-bold">Branch snapshot</h2>
          <div className="mt-4 space-y-3">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className={`flex items-center justify-between rounded-xl p-3 ${
                  selectedBranchId === branch.id
                    ? "bg-blue-50 ring-1 ring-blue-200"
                    : "bg-slate-50"
                }`}
              >
                <div>{branch.name}</div>
                <div className="text-sm text-slate-500">
                  {selectedBranchId === branch.id ? "Selected" : "Operational access"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-bold">Inventory attention</h2>
          <div className="mt-4 text-4xl font-extrabold text-amber-600">
            {lowStock}
          </div>
          <div className="text-sm text-slate-500">
            Low or out-of-stock rows for {selectedBranchName.toLowerCase()}.
          </div>
        </div>
      </div>
    </div>
  );
}
