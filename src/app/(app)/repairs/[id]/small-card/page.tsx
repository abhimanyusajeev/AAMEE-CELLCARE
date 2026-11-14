import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireBranchAccess } from "@/lib/auth/session";
import PrintButton from "./PrintButton";

type StickerSize = "large" | "compact";

export default async function SmallJobCard({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ size?: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const { size } = await searchParams;
  const stickerSize: StickerSize = size === "compact" ? "compact" : "large";

  const repair = await prisma.repairJob.findUnique({
    where: { id },
    include: { customer: true, branch: true, device: true },
  });

  if (!repair) notFound();
  await requireBranchAccess(user.id, user.role, repair.branchId);

  const customerName = repair.customer?.name || "Walk-in customer";
  const customerPhone = repair.customer?.phone || "—";
  const receivedDate = new Date(repair.createdAt).toLocaleDateString("en-IN");
  const deviceName = [repair.device?.brand, repair.device?.model].filter(Boolean).join(" ");

  return (
    <main className="sticker-page mx-auto w-full max-w-xl p-4 text-slate-950">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/repairs/${id}`} className="text-sm font-semibold text-blue-700">← Back to repair</Link>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/repairs/${id}/small-card?size=large`}
            aria-current={stickerSize === "large" ? "page" : undefined}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${stickerSize === "large" ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300 bg-white"}`}
          >
            2 × 1.5 in
          </Link>
          <Link
            href={`/repairs/${id}/small-card?size=compact`}
            aria-current={stickerSize === "compact" ? "page" : undefined}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${stickerSize === "compact" ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-300 bg-white"}`}
          >
            2 × 1 in
          </Link>
          <PrintButton />
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-600 print:hidden">
        Device identification sticker · {stickerSize === "large" ? "50 × 38 mm" : "50 × 25 mm"}
      </p>

      <article className={`device-sticker device-sticker--${stickerSize}`}>
        <header className="sticker-header">
          <img
            src="/branding/aamee-cellcare-logo.png"
            alt="Aamee Cellcare"
            className="sticker-logo"
          />
          <div className="sticker-tagline">The Complete Digital Solutions</div>
          <div className="sticker-contact">THURUTHY JN. · 920 727 7210 · 920 727 7770</div>
        </header>

        <div className="sticker-job-number">
          <span>JOB CARD</span>
          <strong>{repair.ticketNumber}</strong>
        </div>

        <div className="sticker-fields">
          <div className="sticker-field"><span>Name</span><strong>{customerName}</strong></div>
          <div className="sticker-field"><span>Mob</span><strong>{customerPhone}</strong></div>
          <div className="sticker-field"><span>Created</span><strong>{receivedDate}</strong></div>
          {stickerSize === "large" && deviceName ? (
            <div className="sticker-field sticker-device"><span>Device</span><strong>{deviceName}</strong></div>
          ) : null}
        </div>
      </article>

      <style>{`
        .device-sticker {
          box-sizing: border-box;
          width: 50mm;
          height: 38mm;
          overflow: hidden;
          border: .25mm solid #777;
          background: #fff;
          color: #171717;
          font-family: Arial, Helvetica, sans-serif;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        .device-sticker--compact { height: 25mm; }
        .sticker-header { text-align: center; }
        .sticker-logo {
          display: block;
          width: 31mm;
          height: 9mm;
          object-fit: contain;
          margin: 1mm auto 0;
        }
        .sticker-tagline { font-size: 5pt; line-height: 1.1; color: #555; }
        .sticker-contact {
          margin-top: 1mm;
          padding: 1mm .5mm;
          background: #c94e42;
          color: #fff;
          font-size: 5.1pt;
          line-height: 1.2;
          font-weight: 700;
          white-space: nowrap;
        }
        .sticker-job-number {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1mm;
          padding: 1.3mm 2mm;
          border-bottom: .2mm solid #aaa;
        }
        .sticker-job-number span { font-size: 5.5pt; font-weight: 700; }
        .sticker-job-number strong { font-size: 10pt; line-height: 1; }
        .sticker-fields { padding: 0 2mm; }
        .sticker-field {
          min-height: 5.1mm;
          display: grid;
          grid-template-columns: 11mm minmax(0, 1fr);
          align-items: center;
          gap: 1mm;
          border-bottom: .15mm solid #c7c7c7;
          font-size: 6.2pt;
          line-height: 1.1;
        }
        .sticker-field span { color: #555; font-weight: 700; }
        .sticker-field strong {
          font-weight: 600;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }
        .device-sticker--compact .sticker-logo { height: 6mm; width: 27mm; }
        .device-sticker--compact .sticker-tagline { display: none; }
        .device-sticker--compact .sticker-contact { margin-top: .5mm; font-size: 4.7pt; }
        .device-sticker--compact .sticker-job-number { padding: 1mm 1.5mm; }
        .device-sticker--compact .sticker-job-number strong { font-size: 9pt; }
        .device-sticker--compact .sticker-fields { padding: 0 1.5mm; }
        .device-sticker--compact .sticker-field { min-height: 4.2mm; font-size: 5.8pt; grid-template-columns: 9mm minmax(0, 1fr); }
        @media screen {
          .device-sticker { box-shadow: 0 4px 18px rgba(15,23,42,.12); }
        }
        @media print {
          @page { size: 50mm ${stickerSize === "large" ? "38mm" : "25mm"}; margin: 0; }
          html, body { width: 50mm !important; height: ${stickerSize === "large" ? "38mm" : "25mm"} !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .device-sticker, .device-sticker * { visibility: visible !important; }
          .sticker-page { width: 50mm !important; max-width: none !important; margin: 0 !important; padding: 0 !important; }
          .device-sticker { position: absolute; left: 0; top: 0; box-shadow: none !important; }
        }
      `}</style>
    </main>
  );
}
