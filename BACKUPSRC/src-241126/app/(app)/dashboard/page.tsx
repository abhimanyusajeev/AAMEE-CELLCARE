import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { getBranchScope } from "@/lib/branch-scope";
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";

const money = (value: unknown) => `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const statusLabels: Record<string, string> = {
  RECEIVED: "Received", DIAGNOSIS: "Inspection", WAITING_FOR_CUSTOMER_APPROVAL: "Awaiting approval",
  WAITING_FOR_PARTS: "Waiting parts", REPAIRING: "Repairing", READY_FOR_PICKUP: "Ready", DELIVERED: "Delivered", CANCELLED: "Cancelled",
};
const statusColors: Record<string, string> = {
  RECEIVED: "bg-sky-100 text-sky-800", DIAGNOSIS: "bg-indigo-100 text-indigo-800",
  WAITING_FOR_CUSTOMER_APPROVAL: "bg-amber-100 text-amber-800", WAITING_FOR_PARTS: "bg-orange-100 text-orange-800",
  REPAIRING: "bg-violet-100 text-violet-800", READY_FOR_PICKUP: "bg-emerald-100 text-emerald-800",
  DELIVERED: "bg-slate-100 text-slate-700", CANCELLED: "bg-rose-100 text-rose-800",
};

type SearchParams = Promise<{ period?: string; from?: string; to?: string }>;
function validDate(value?: string, end = false) {
  if (!value) return null;
  const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export default async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAuth();
  const { branches, branchIds, selectedBranchName } = await getBranchScope(user);
  const params = await searchParams;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const period = params.period ?? "today";
  let from = todayStart;
  let to = todayEnd;
  if (period === "yesterday") { from = startOfDay(subDays(now, 1)); to = endOfDay(subDays(now, 1)); }
  else if (period === "week") { from = startOfWeek(now, { weekStartsOn: 1 }); to = todayEnd; }
  else if (period === "month") { from = startOfMonth(now); to = todayEnd; }
  else if (period === "custom") { from = validDate(params.from) ?? todayStart; to = validDate(params.to, true) ?? todayEnd; }
  if (from > to) { from = todayStart; to = todayEnd; }

  const owner = user.role === "OWNER";
  const openStatuses = ["RECEIVED", "DIAGNOSIS", "WAITING_FOR_CUSTOMER_APPROVAL", "WAITING_FOR_PARTS", "REPAIRING", "READY_FOR_PICKUP"] as const;
  const chartFrom = startOfDay(subDays(now, 29));
  const [salesSummary, salePayments, repairPayments, chartRows, visits, receivedJobs, deliveredJobs, statusRows, lowStock, openJobs, recentJobs, recentSales] = await Promise.all([
    owner ? prisma.sale.aggregate({ where: { branchId: { in: branchIds }, status: "COMPLETED", createdAt: { gte: from, lte: to } }, _sum: { total: true }, _count: { _all: true } }) : Promise.resolve(null),
    owner ? prisma.payment.findMany({ where: { branchId: { in: branchIds }, status: "COMPLETED", paidAt: { gte: from, lte: to } }, select: { amount: true } }) : Promise.resolve([]),
    owner ? prisma.repairPayment.findMany({ where: { branchId: { in: branchIds }, paidAt: { gte: from, lte: to } }, select: { amount: true } }) : Promise.resolve([]),
    owner ? prisma.transaction.findMany({ where: { branchId: { in: branchIds }, type: { in: ["SALE", "REPAIR"] }, createdAt: { gte: chartFrom, lte: todayEnd } }, select: { amount: true, createdAt: true } }) : Promise.resolve([]),
    prisma.customerVisit.count({ where: { branchId: { in: branchIds }, visitedAt: { gte: from, lte: to } } }),
    prisma.repairJob.count({ where: { branchId: { in: branchIds }, createdAt: { gte: from, lte: to } } }),
    prisma.repairJob.count({ where: { branchId: { in: branchIds }, status: "DELIVERED", deliveredAt: { gte: from, lte: to } } }),
    prisma.repairJob.groupBy({ where: { branchId: { in: branchIds } }, by: ["status"], _count: { _all: true } }),
    prisma.inventoryItem.count({ where: { branchId: { in: branchIds }, OR: [{ quantity: 0 }, { quantity: { lte: 2 } }] } }),
    prisma.repairJob.findMany({ where: { branchId: { in: branchIds }, status: { in: openStatuses } }, select: { id: true, ticketNumber: true, status: true, createdAt: true, updatedAt: true, balanceAmount: true, customer: { select: { name: true } }, technician: { select: { name: true } }, branch: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }),
    prisma.repairJob.findMany({ where: { branchId: { in: branchIds } }, select: { id: true, ticketNumber: true, status: true, createdAt: true, customer: { select: { name: true } }, device: { select: { brand: true, model: true } }, technician: { select: { name: true } }, branch: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    owner ? prisma.sale.findMany({ where: { branchId: { in: branchIds }, status: "COMPLETED", createdAt: { gte: from, lte: to } }, select: { id: true, total: true, createdAt: true, branch: { select: { name: true } }, customer: { select: { name: true } }, createdBy: { select: { name: true } }, invoice: { select: { invoiceNumber: true } } }, orderBy: { createdAt: "desc" }, take: 6 }) : Promise.resolve([]),
  ]);

  const totalCollection = [...salePayments, ...repairPayments].reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const saleRevenue = Number(salesSummary?._sum.total ?? 0);
  const openCount = openStatuses.reduce((total, status) => total + (statusRows.find((row) => row.status === status)?._count._all ?? 0), 0);
  const pipelineStatuses = ["RECEIVED", "DIAGNOSIS", "REPAIRING", "WAITING_FOR_PARTS", "READY_FOR_PICKUP", "DELIVERED"];
  const countFor = (status: string) => statusRows.find((row) => row.status === status)?._count._all ?? 0;
  const sevenDaysAgo = subDays(now, 7);
  const twoDaysAgo = subDays(now, 2);
  const threeDaysAgo = subDays(now, 3);
  const thirtyDaysAgo = subDays(now, 30);
  const oldOpen = openJobs.filter((job) => job.status !== "READY_FOR_PICKUP" && job.createdAt < sevenDaysAgo).length;
  const readyOld = openJobs.filter((job) => job.status === "READY_FOR_PICKUP" && job.updatedAt < twoDaysAgo).length;
  const waitingPartsOld = openJobs.filter((job) => job.status === "WAITING_FOR_PARTS" && job.updatedAt < threeDaysAgo).length;
  const overdueRepairRows = openJobs.filter((job) => Number(job.balanceAmount ?? 0) > 0 && job.createdAt < thirtyDaysAgo);
  const receivableBuckets = [0, 0, 0, 0];
  for (const job of openJobs) {
    const balance = Number(job.balanceAmount ?? 0);
    if (balance <= 0) continue;
    const age = Math.floor((now.getTime() - job.createdAt.getTime()) / 86400000);
    receivableBuckets[age <= 30 ? 0 : age <= 60 ? 1 : age <= 90 ? 2 : 3] += balance;
  }
  const revenueByDay = Array.from({ length: 30 }, (_, index) => {
    const date = startOfDay(subDays(now, 29 - index));
    return { label: format(date, "dd MMM"), dateKey: format(date, "yyyy-MM-dd"), amount: 0 };
  });
  for (const row of chartRows) {
    const key = format(row.createdAt, "yyyy-MM-dd");
    const day = revenueByDay.find((item) => item.dateKey === key);
    if (day) day.amount += Number(row.amount ?? 0);
  }
  const maxRevenue = Math.max(1, ...revenueByDay.map((day) => day.amount));
  const attentionItems: { label: string; count: number; href: string }[] = [
    { label: "Open for 7+ days", count: oldOpen, href: "/repairs" },
    { label: "Ready for pickup for 2+ days", count: readyOld, href: "/repairs?status=READY_FOR_PICKUP" },
    { label: "Waiting for parts for 3+ days", count: waitingPartsOld, href: "/repairs?status=WAITING_FOR_PARTS" },
    { label: "Low / out-of-stock items", count: lowStock, href: "/inventory" },
    ...(owner ? [{ label: "Repair balances older than 30 days", count: overdueRepairRows.length, href: "/repairs" }] : []),
  ];
  const periodLabel = period === "today" ? "Today" : period === "yesterday" ? "Yesterday" : period === "week" ? "This week" : period === "month" ? "This month" : "Custom period";
  const periodHref = (value: string) => `/dashboard?period=${value}`;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm text-slate-500">{format(now, "EEEE, dd MMM yyyy")}</p><h1 className="text-3xl font-black tracking-tight text-slate-900">Dashboard</h1><p className="mt-1 text-sm text-slate-500">Operational overview · {selectedBranchName}</p></div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {([ ["today", "Today"], ["yesterday", "Yesterday"], ["week", "This Week"], ["month", "This Month"] ] as const).map(([key, label]) => <Link key={key} href={periodHref(key)} className={`rounded-xl border px-3 py-2 font-semibold ${period === key ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{label}</Link>)}
        <form action="/dashboard" className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2"><input type="hidden" name="period" value="custom"/><input aria-label="From date" name="from" type="date" defaultValue={params.from ?? ""} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"/><input aria-label="To date" name="to" type="date" defaultValue={params.to ?? ""} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"/><button className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Apply</button></form>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Link href="/repairs/new" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 font-semibold shadow-sm hover:border-teal-300"><span><span className="block text-xs text-slate-500">Quick action</span>＋ New Job Card</span><span className="text-xl text-teal-700">→</span></Link>
      <Link href="/sales/new" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 font-semibold shadow-sm hover:border-teal-300"><span><span className="block text-xs text-slate-500">Quick action</span>▣ New Sale</span><span className="text-xl text-teal-700">→</span></Link>
      <Link href="/repairs" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 font-semibold shadow-sm hover:border-teal-300"><span><span className="block text-xs text-slate-500">Quick action</span>⌕ Scan / Find Job</span><span className="text-xl text-teal-700">→</span></Link>
      {owner && <Link href="/transactions" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 font-semibold shadow-sm hover:border-teal-300"><span><span className="block text-xs text-slate-500">Owner action</span>₹ Receive / Review</span><span className="text-xl text-teal-700">→</span></Link>}
      <Link href="/customers" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 font-semibold shadow-sm hover:border-teal-300"><span><span className="block text-xs text-slate-500">Quick action</span>♙ Customers</span><span className="text-xl text-teal-700">→</span></Link>
    </div>

    <div className={`grid gap-4 ${owner ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
      {owner && <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500"><span>Collection · {periodLabel}</span><span className="text-teal-700">₹</span></div><div className="mt-2 text-3xl font-black text-slate-950">{money(totalCollection)}</div><p className="mt-2 text-xs text-slate-500">Recorded sales and repair revenue in the transaction ledger</p></div>}
      {owner && <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500"><span>Sales · {periodLabel}</span><span className="text-teal-700">▣</span></div><div className="mt-2 text-3xl font-black text-slate-950">{money(saleRevenue)}</div><p className="mt-2 text-xs text-slate-500">{salesSummary?._count._all ?? 0} completed bills</p></div>}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500"><span>Jobs · {periodLabel}</span><span className="text-teal-700">▯</span></div><div className="mt-2 flex items-baseline gap-2"><span className="text-3xl font-black text-slate-950">{receivedJobs}</span><span className="text-xs text-slate-500">received</span><span className="text-2xl font-black text-slate-950">{deliveredJobs}</span><span className="text-xs text-slate-500">delivered</span></div><p className="mt-2 text-xs text-slate-500">{openCount} currently open across selected shops</p></div>
      {owner ? <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500"><span>Repair dues</span><span className="text-teal-700">▱</span></div><div className="mt-2 text-3xl font-black text-slate-950">{money(openJobs.reduce((sum, job) => sum + Math.max(0, Number(job.balanceAmount ?? 0)), 0))}</div><p className="mt-2 text-xs text-slate-500">Outstanding balance on open repair jobs</p></div> : <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-bold uppercase tracking-wide text-slate-500">Customer visits · {periodLabel}</div><div className="mt-2 text-3xl font-black text-slate-950">{visits}</div><p className="mt-2 text-xs text-slate-500">Customer visits recorded in this period</p></div>}
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 p-5"><div><h2 className="font-extrabold text-slate-900">Needs attention</h2><p className="mt-1 text-xs text-slate-500">Items that may need a follow-up</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${oldOpen + readyOld + waitingPartsOld + lowStock > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{oldOpen + readyOld + waitingPartsOld + lowStock ? "Review needed" : "All clear"}</span></div>
        <div className="divide-y divide-slate-100">
          {attentionItems.map((item) => <Link key={item.label} href={item.href} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50"><span className="text-slate-700">{item.label}</span><span className={`font-bold tabular-nums ${item.count ? "text-amber-700" : "text-emerald-600"}`}>{item.count}</span></Link>)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-extrabold text-slate-900">Service pipeline</h2><p className="mt-1 text-xs text-slate-500">Current job-card status across {selectedBranchName}</p></div><span className="text-xs text-slate-500">{openCount} open jobs</span></div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pipelineStatuses.map((status) => <Link key={status} href={`/repairs?status=${status}`} className="rounded-xl bg-slate-50 p-3 hover:bg-teal-50"><div className="text-2xl font-black text-slate-950">{countFor(status)}</div><div className="mt-1 text-xs text-slate-600">{statusLabels[status]}</div></Link>)}
        </div>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-100">{pipelineStatuses.filter((s) => s !== "DELIVERED").map((status) => <div key={status} title={`${statusLabels[status]}: ${countFor(status)}`} className={status === "READY_FOR_PICKUP" ? "bg-emerald-500" : status === "REPAIRING" ? "bg-violet-500" : status === "WAITING_FOR_PARTS" ? "bg-orange-400" : "bg-teal-500"} style={{ width: `${openCount ? (countFor(status) / openCount) * 100 : 0}%` }} />)}</div>
      </section>
    </div>

    {owner && <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-extrabold">Receivables by age</h2><p className="mt-1 text-xs text-slate-500">Open repair balances grouped by job-card age</p></div><span className="text-sm font-extrabold text-teal-700">{money(receivableBuckets.reduce((a, b) => a + b, 0))}</span></div><div className="mt-5 space-y-4">{["0–30 days", "31–60 days", "61–90 days", "90+ days"].map((label, index) => <div key={label} className="grid grid-cols-[76px_1fr_72px] items-center gap-3 text-xs"><span className="text-slate-500">{label}</span><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.max(0, (receivableBuckets[index] / Math.max(1, ...receivableBuckets)) * 100)}%` }}/></div><strong className="text-right text-slate-900">{money(receivableBuckets[index])}</strong></div>)}</div><p className="mt-3 text-[11px] text-slate-400">Age is calculated from repair job creation date, not a separate invoice due date.</p></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="font-extrabold">Revenue · last 30 days</h2><p className="mt-1 text-xs text-slate-500">Sales and repair revenue recorded in the transaction ledger</p></div><Link href="/transactions" className="text-xs font-bold text-teal-700">View transactions →</Link></div><div className="mt-5 flex h-36 items-end gap-1">{revenueByDay.map((day) => <div key={day.dateKey} title={`${day.label}: ${money(day.amount)}`} className="group flex h-full min-w-0 flex-1 items-end"><div className="w-full rounded-t-sm bg-teal-500/80 group-hover:bg-teal-700" style={{ height: `${day.amount ? Math.max(4, (day.amount / maxRevenue) * 100) : 0}%` }}/></div>)}</div><div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>{revenueByDay[0]?.label}</span><span>{revenueByDay[14]?.label}</span><span>{revenueByDay[29]?.label}</span></div></section>
    </div>}

    <div className="grid gap-4 xl:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-extrabold">Recent job cards</h2><p className="mt-1 text-xs text-slate-500">Latest repair jobs from selected shops</p></div><Link href="/repairs" className="text-xs font-bold text-teal-700">View all →</Link></div><div className="divide-y divide-slate-100">{recentJobs.map((job) => <Link key={job.id} href={`/repairs/${job.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50"><div className="min-w-0"><div className="font-bold text-blue-700">{job.ticketNumber}</div><div className="truncate text-sm text-slate-800">{job.customer?.name || "Walk-in"} · {[job.device?.brand, job.device?.model].filter(Boolean).join(" ") || "Device"}</div><div className="mt-1 text-[11px] text-slate-500">{job.technician?.name || "Unassigned"} · {job.branch.name} · {format(job.createdAt, "dd MMM yyyy, hh:mm a")}</div></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusColors[job.status] ?? "bg-slate-100 text-slate-700"}`}>{statusLabels[job.status] ?? job.status}</span></Link>)}{!recentJobs.length && <p className="p-8 text-center text-sm text-slate-500">No job cards found for this shop selection.</p>}</div></section>

      {owner ? <section className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="font-extrabold">Recent receipts & sales</h2><p className="mt-1 text-xs text-slate-500">Latest completed sales in the selected period</p></div><Link href="/sales" className="text-xs font-bold text-teal-700">View all →</Link></div><div className="divide-y divide-slate-100">{recentSales.map((sale) => <div key={sale.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><div className="font-bold text-slate-900">{sale.invoice?.invoiceNumber ?? "Sale"}</div><div className="truncate text-sm text-slate-600">{sale.customer?.name ?? "Walk-in"} · {sale.branch.name}</div><div className="mt-1 text-[11px] text-slate-500">{sale.createdBy.name} · {format(sale.createdAt, "dd MMM yyyy, hh:mm a")}</div></div><strong className="shrink-0 text-sm text-slate-900">{money(sale.total)}</strong></div>)}{!recentSales.length && <p className="p-8 text-center text-sm text-slate-500">No completed sales in this period.</p>}</div></section> : <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-extrabold">Your shop overview</h2><p className="mt-1 text-xs text-slate-500">Operational information for your assigned shop access</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-4"><div className="text-2xl font-black">{visits}</div><div className="text-xs text-slate-500">Customer visits · {periodLabel}</div></div><div className="rounded-xl bg-slate-50 p-4"><div className="text-2xl font-black">{lowStock}</div><div className="text-xs text-slate-500">Low stock items</div></div></div></section>}
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500"><strong className="text-slate-700">Data scope:</strong> {selectedBranchName}. {branches.length} accessible shop(s) · {owner ? "Owner financial dashboard enabled." : "Financial dashboard figures are hidden for employee accounts."}</div>
  </div>;
}
