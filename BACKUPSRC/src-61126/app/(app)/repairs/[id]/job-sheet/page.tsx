import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireBranchAccess } from "@/lib/auth/session";
import PrintJobSheetButton from "./PrintJobSheetButton";

const terms = [
  "Please submit this job sheet when collecting your device.",
  "The device should be collected within 15 days after bill payment.",
  "We are not responsible for devices left with us more than 30 days from the date of entry.",
  "Please report any service-related complaint within 48 hours of collection.",
  "We are not responsible for issues caused by service or repair performed elsewhere after our service.",
  "Hardware or software issues in water-damaged or dropped devices are handled at the customer's risk.",
];
const termsMl = [
  "ഉപകരണം തിരികെ വാങ്ങുമ്പോൾ ഈ ജോബ് ഷീറ്റ് സമർപ്പിക്കുക.",
  "ബിൽ തുക അടച്ചതിന് ശേഷം 15 ദിവസത്തിനകം ഉപകരണം കൈപ്പറ്റണം.",
  "എൻട്രി തീയതി മുതൽ 30 ദിവസത്തിന് ശേഷം ഉപേക്ഷിച്ച ഉപകരണങ്ങളുടെ ഉത്തരവാദിത്വം സ്ഥാപനത്തിനുണ്ടാകില്ല.",
  "സർവീസുമായി ബന്ധപ്പെട്ട പരാതികൾ ഉപകരണം കൈപ്പറ്റി 48 മണിക്കൂറിനകം അറിയിക്കുക.",
  "ഞങ്ങളുടെ സർവീസിന് ശേഷം മറ്റെവിടെയെങ്കിലും ചെയ്ത ജോലികൾ മൂലമുള്ള പ്രശ്നങ്ങൾക്ക് ഞങ്ങൾ ഉത്തരവാദികളല്ല.",
  "വെള്ളം കയറിയതോ വീണ് കേടായതോ ആയ ഉപകരണങ്ങളിലെ ഹാർഡ്‌വെയർ/സോഫ്റ്റ്‌വെയർ പ്രശ്നങ്ങൾ ഉപഭോക്താവിന്റെ ഉത്തരവാദിത്വത്തിലാണ്.",
];
const money = (n: unknown) => `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default async function JobSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  const { id } = await params;
  const repair = await prisma.repairJob.findUnique({ where: { id }, include: { branch: true, customer: true, device: true, inspections: { orderBy: { item: "asc" } }, accessories: { orderBy: { createdAt: "asc" } }, technician: { select: { name: true } } } });
  if (!repair) notFound();
  await requireBranchAccess(user.id, user.role, repair.branchId);
  const phone1 = "920 727 7210";
  const phone2 = "920 727 7770";
  const device = [repair.device?.brand, repair.device?.model].filter(Boolean).join(" ") || repair.deviceType;
  const accessories = repair.accessories.map((a) => `${a.name}${a.quantity > 1 ? ` × ${a.quantity}` : ""}`).join(", ");
  const condition = repair.device?.condition || "Not recorded";
  const missing = [repair.device?.chargerReceived ? "" : "Charger", repair.device?.bagReceived ? "" : "Bag / cover"].filter(Boolean).join(", ") || "None recorded";
  return <main className="job-sheet-page mx-auto max-w-4xl space-y-4 p-3 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden"><Link href={`/repairs/${repair.id}`} className="text-sm font-semibold text-blue-700">← Back to repair</Link><PrintJobSheetButton /></div>
    <article className="job-sheet rounded-lg border border-slate-300 bg-white p-5 text-slate-900 sm:p-8">
      <header className="grid grid-cols-1 items-center gap-4 border-b-2 border-slate-300 pb-4 sm:grid-cols-[1.2fr_1fr]">
        <div><Image src="/branding/aamee-cellcare-logo.png" alt="Aamee Cellcare" width={1030} height={490} priority className="h-auto w-52 object-contain"/><p className="mt-1 text-xs font-semibold text-slate-600">The Complete Digital Solutions</p></div>
        <div className="text-sm leading-6 sm:text-right"><p className="font-bold">AAMEE CELLCARE</p><p>☎ {phone1}</p><p>☎ {phone2}</p><p>{repair.branch.address}</p><p>{repair.branch.email || "aameecellcare@gmail.com"}</p></div>
      </header>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div><span className="text-sm">Job Card No:</span> <strong className="text-xl">{repair.ticketNumber}</strong></div><span className="rounded-full bg-slate-700 px-5 py-2 text-sm font-bold tracking-wide text-white">JOB SHEET</span><div className="text-sm"><strong>Date:</strong> {new Date(repair.receivedAt).toLocaleDateString("en-IN")}</div></div>
      <section className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <Field label="Name" value={repair.customer?.name || "Walk-in customer"}/><Field label="Address" value={repair.customer?.address || ""}/><Field label="Phone" value={repair.customer?.phone || ""}/><Field label="Device / Model" value={device}/><Field label="IMEI" value={repair.device?.imei || ""}/><Field label="Serial No." value={repair.device?.serialNumber || ""}/><Field label="Complaint" value={repair.issue}/><Field label="Remark" value={repair.notes || repair.diagnosis || ""}/><Field label="Accessories received" value={accessories || (repair.device?.chargerReceived || repair.device?.bagReceived ? [repair.device?.chargerReceived ? "Charger" : "", repair.device?.bagReceived ? "Bag / cover" : ""].filter(Boolean).join(", ") : "None")}/><Field label="Missing / not received" value={missing}/><Field label="Condition of device" value={condition}/>
      </section>
      <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><AmountBox label="Estimate Charge" value={money(repair.estimate)}/><AmountBox label="Advance" value={money(repair.advanceAmount)}/><AmountBox label="Warranty" value="________________"/><AmountBox label="Guarantee" value="________________"/></section>
      <section className="mt-5"><h2 className="border-b border-slate-300 pb-1 text-sm font-extrabold">Device Pre-Check</h2><div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">{repair.inspections.map((item) => <div key={item.id} className="flex justify-between gap-2 border-b border-dotted border-slate-300 py-1 text-xs"><span>{item.item}</span><strong>{item.status}</strong></div>)}</div></section>
      <section className="mt-5"><h2 className="text-sm font-extrabold">Terms &amp; Conditions</h2><div className="mt-2 grid grid-cols-1 gap-4 text-[10px] leading-[1.45] sm:grid-cols-2"><ul className="space-y-1.5">{terms.map((t) => <li key={t} className="flex gap-1.5"><span>›</span><span>{t}</span></li>)}</ul><ul className="space-y-1.5" lang="ml">{termsMl.map((t) => <li key={t} className="flex gap-1.5"><span>›</span><span>{t}</span></li>)}</ul></div></section>
      <footer className="mt-10 grid grid-cols-2 gap-8 text-center text-xs"><div className="border-t border-slate-500 pt-2">Signature of Customer</div><div className="border-t border-slate-500 pt-2">Authorized Signature</div></footer>
    </article>
    <style>{`@media print { @page { size: A4; margin: 10mm; } body { background:#fff !important; } body * { visibility:hidden; } .job-sheet-page, .job-sheet-page * { visibility:visible; } .job-sheet-page { position:absolute; left:0; top:0; width:100%; max-width:none; padding:0 !important; margin:0 !important; } .job-sheet { border:1px solid #777 !important; border-radius:0 !important; box-shadow:none !important; padding:7mm !important; font-size:10pt; } .job-sheet header img { width:48mm !important; } .job-sheet section { break-inside:avoid; } }`}</style>
  </main>;
}
function Field({ label, value }: { label: string; value: string }) { return <div className="min-w-0 border-b border-dotted border-slate-400 pb-1"><span className="font-bold">{label}: </span><span className="whitespace-pre-wrap break-words">{value || " "}</span></div>; }
function AmountBox({ label, value }: { label: string; value: string }) { return <div className="min-w-0 border border-slate-500 p-2"><div className="text-[10px] font-bold">{label}</div><div className="mt-1 min-h-5 break-words text-sm font-semibold">{value}</div></div>; }
