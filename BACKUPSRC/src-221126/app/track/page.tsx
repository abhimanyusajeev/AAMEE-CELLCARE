import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  RECEIVED: "Job card created",
  DIAGNOSIS: "Inspection / diagnosis in progress",
  WAITING_FOR_CUSTOMER_APPROVAL: "Waiting for your approval",
  WAITING_FOR_PARTS: "Waiting for spare parts",
  REPAIRING: "Repair in progress",
  READY_FOR_PICKUP: "Ready for pickup",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export default async function TrackRepairPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const repair = id
    ? await prisma.repairJob.findUnique({
        where: { id },
        select: {
          ticketNumber: true,
          status: true,
          receivedAt: true,
          updatedAt: true,
          promisedDate: true,
          device: { select: { brand: true, model: true } },
          branch: { select: { name: true } },
          statusHistory: {
            select: { newStatus: true, changedAt: true },
            orderBy: { changedAt: "desc" },
            take: 8,
          },
        },
      })
    : null;

  if (!repair) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h1 className="text-2xl font-black">AAMEE CELLCARE</h1>
          <p className="mt-3 text-sm text-slate-600">We couldn’t find this repair tracking link. Please check the link in your WhatsApp message or contact our team.</p>
          <p className="mt-5 text-sm font-semibold">9207277210 · 9207277770</p>
        </section>
      </main>
    );
  }

  const device = [repair.device?.brand, repair.device?.model].filter(Boolean).join(" ") || "Device";
  const status = statusLabels[repair.status] || repair.status.replaceAll("_", " ");
  const timeline = [...repair.statusHistory];
  if (!timeline.some((item) => item.newStatus === repair.status)) {
    timeline.unshift({ newStatus: repair.status, changedAt: repair.updatedAt });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900 sm:py-16">
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <header className="bg-slate-950 px-6 py-7 text-white sm:px-8">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">AAMEE CELLCARE</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Track your repair</h1>
          <p className="mt-2 text-sm text-slate-300">Repair progress and pickup updates</p>
        </header>
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-4 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Job Card</p>
              <p className="mt-1 text-xl font-black">{repair.ticketNumber}</p>
              <p className="mt-1 text-sm text-slate-600">{device}</p>
            </div>
            <span className="inline-flex w-fit rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-800">{status}</span>
          </div>
          <div className="mt-6">
            <h2 className="text-lg font-extrabold">Repair status</h2>
            <ol className="mt-4 space-y-4">
              {timeline.map((item, index) => (
                <li key={`${item.newStatus}-${index}`} className="flex gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800">✓</span>
                  <div>
                    <p className="text-sm font-bold">{statusLabels[item.newStatus] || item.newStatus.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(item.changedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          {repair.promisedDate && <p className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><strong>Expected delivery:</strong> {new Date(repair.promisedDate).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" })}</p>}
          <footer className="mt-8 border-t border-slate-100 pt-5 text-sm text-slate-600">
            <p>Need help? Contact AAMEE CELLCARE.</p>
            <p className="mt-1 font-bold text-slate-900">9207277210 · 9207277770</p>
          </footer>
        </div>
      </section>
    </main>
  );
}
