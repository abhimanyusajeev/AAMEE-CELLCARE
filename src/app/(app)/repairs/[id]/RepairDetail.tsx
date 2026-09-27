"use client";
import { useMemo, useState } from "react";
import { CheckCircle2, MessageCircle, PackagePlus, Send, Wrench } from "lucide-react";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const statuses = [
  ["RECEIVED", "Received"], ["DIAGNOSIS", "Inspection"], ["WAITING_FOR_CUSTOMER_APPROVAL", "Awaiting Approval"], ["WAITING_FOR_PARTS", "Waiting for Parts"], ["REPAIRING", "Repair In Progress"], ["READY_FOR_PICKUP", "Ready for Delivery"], ["DELIVERED", "Delivered"], ["CANCELLED", "Cancelled"],
] as const;
const inspectionItems = ["Display", "Touch", "Front Camera", "Rear Camera", "Speaker", "Microphone", "Earpiece", "Wi-Fi", "Bluetooth", "Charging Port", "Battery", "Fingerprint / Face ID", "Buttons", "Body / Frame"];
const statusLabel = Object.fromEntries(statuses);

export function RepairDetail({ repair, technicians, products }: { repair: any; technicians: any[]; products: any[] }) {
  const [row, setRow] = useState(repair);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(""); const [toast, setToast] = useState("");
  const [accessory, setAccessory] = useState("");
  const [partId, setPartId] = useState("");
  const [partQty, setPartQty] = useState("1");
  const [selectedStatus, setSelectedStatus] = useState(row.status);
  const currentInspection = useMemo(() => Object.fromEntries((row.inspections ?? []).map((x: any) => [x.item, x.status])), [row.inspections]);

  async function patch(payload: any) {
    setSaving(true); setToast("");
    const r = await fetch(`/api/repairs/${row.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setMessage(data.message || "Unable to save"); return; }
    setRow(data.repair); setSelectedStatus(data.repair.status); setToast(data.whatsapp?.sent ? "Saved and WhatsApp update sent." : "Saved successfully.");
  }

  async function addAccessory() { if (!accessory.trim()) return; await patch({ addAccessory: { name: accessory.trim(), quantity: 1 } }); setAccessory(""); }
  async function addPart() { if (!partId) return; await patch({ addPart: { productVariantId: partId, quantity: Number(partQty || 1) } }); setPartId(""); setPartQty("1"); }
  function openWhatsApp() {
    const phone = row.customer?.phone;
    if (!phone) { setToast("Customer phone number is missing."); return; }
    const customer = row.customer?.name || "Customer";
    const device = [row.device?.brand, row.device?.model].filter(Boolean).join(" ") || "your device";
    const stage = statusLabel[row.status] || row.status;
    const message = `Hello ${customer},\n\nAamee Cellcare update\nJob Card: ${row.ticketNumber}\nDevice: ${device}\nStatus: ${stage}\nIssue: ${row.issue || "-"}\nEstimate: ₹${Number(row.estimate || 0).toLocaleString("en-IN")}\nBalance: ₹${Number(row.balanceAmount || 0).toLocaleString("en-IN")}\n\nThank you,\nAamee Cellcare`;
    const url = buildWhatsAppLink(phone, message);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  }

  return <div className="space-y-4">
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><div className="text-xs font-bold uppercase tracking-wider text-blue-700">Job Card</div><h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">{row.ticketNumber}</h1><p className="mt-1 text-sm text-slate-500">{row.customer?.name || "Walk-in customer"} · {row.device?.brand || "Device"} {row.device?.model || ""}</p></div>
        <div className="flex flex-wrap gap-2"><select value={selectedStatus} disabled={saving} onChange={e => { setSelectedStatus(e.target.value); patch({ status: e.target.value }); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">{statuses.map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select><button onClick={openWhatsApp} disabled={saving || !row.customer?.phone} title={!row.customer?.phone ? "Customer phone number is missing" : "Open WhatsApp with a pre-filled message"} className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><MessageCircle size={17}/> WhatsApp Customer</button>{row.invoice ? <span className="inline-flex items-center rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Invoice {row.invoice.invoiceNumber}</span> : <button onClick={()=>patch({createInvoice:true})} disabled={saving} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800">Generate Invoice</button>}</div>
      </div>
      <div className="mt-5 grid gap-2 overflow-x-auto sm:grid-cols-4 xl:grid-cols-8">{statuses.slice(0,7).map(([value,label], i) => <div key={value} className={`min-w-[130px] rounded-xl border p-3 ${row.status === value ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"}`}><div className="flex items-center gap-2 text-xs font-bold"><span className="grid h-6 w-6 place-items-center rounded-full bg-white ring-1 ring-slate-200">{i + 1}</span>{label}</div>{row.status === value && <div className="mt-1 text-[11px] text-blue-700">Current stage</div>}</div>)}</div>
    </div>

    <div className="grid gap-4 xl:grid-cols-[1.45fr_.85fr]">
      <div className="space-y-4">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-extrabold"><Wrench size={19}/> Device & Complaint</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[["Customer",row.customer?.name || "Walk-in"],["Phone",row.customer?.phone || "—"],["Service",row.serviceType],["Device",`${row.device?.brand || ""} ${row.device?.model || ""}`],["IMEI",row.device?.imei || "—"],["Serial",row.device?.serialNumber || "—"],["RAM / Storage",`${row.device?.ram || "—"} / ${row.device?.storage || "—"}`],["Color",row.device?.color || "—"],["Expected Delivery",row.promisedDate ? new Date(row.promisedDate).toLocaleDateString("en-IN") : "—"]].map(([k,v])=><div key={k as string} className="rounded-xl bg-slate-50 p-3"><div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{k}</div><div className="mt-1 break-words text-sm font-semibold text-slate-800">{v}</div></div>)}</div><div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-bold uppercase text-amber-700">Customer Complaint</div><p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{row.issue}</p></div></section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold">Device Inspection</h2><span className="text-xs text-slate-500">YES / NO / N/A</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{inspectionItems.map(item => <div key={item} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3"><span className="text-sm font-semibold">{item}</span><select value={currentInspection[item] || "N/A"} onChange={e => patch({ inspection: { item, status: e.target.value } })} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold"><option>YES</option><option>NO</option><option>N/A</option></select></div>)}</div></section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-extrabold">Accessories Received</h2><div className="flex w-full gap-2 sm:w-auto"><input value={accessory} onChange={e=>setAccessory(e.target.value)} placeholder="e.g. Charger" className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm sm:w-48"/><button onClick={addAccessory} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">Add</button></div></div><div className="mt-4 flex flex-wrap gap-2">{(row.accessories ?? []).length ? row.accessories.map((a:any)=><span key={a.id} className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold">{a.name} × {a.quantity}</span>) : <span className="text-sm text-slate-500">No accessories recorded.</span>}</div></section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-lg font-extrabold"><PackagePlus size={19}/> Parts Used</h2><div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row"><select value={partId} onChange={e=>setPartId(e.target.value)} className="rounded-lg border px-3 py-2 text-sm sm:w-64"><option value="">Select spare part</option>{products.flatMap((p:any)=>p.variants.map((v:any)=><option key={v.id} value={v.id}>{p.name} · {v.name}</option>))}</select><input type="number" min="1" value={partQty} onChange={e=>setPartQty(e.target.value)} className="w-20 rounded-lg border px-3 py-2 text-sm"/><button onClick={addPart} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white">Add</button></div></div><div className="mt-4 space-y-2">{(row.parts ?? []).map((p:any)=><div key={p.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm"><span className="font-semibold">{p.productVariant?.product?.name} · {p.productVariant?.name}</span><span>× {p.quantity} · ₹{Number(p.unitPrice).toLocaleString("en-IN")}</span></div>)}{!(row.parts ?? []).length && <span className="text-sm text-slate-500">No parts used yet.</span>}</div></section>
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6"><h2 className="text-lg font-extrabold">Job Card Controls</h2><label className="mt-4 block text-sm font-semibold">Technician<select value={row.technicianId || ""} onChange={e=>patch({technicianId:e.target.value || null})} className="mt-2 w-full rounded-lg border p-3"><option value="">Unassigned</option>{technicians.map(t=><option key={t.id} value={t.id}>{t.name} · {t.role}</option>)}</select></label><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-blue-50 p-4"><div className="text-xs text-slate-500">Estimate</div><div className="mt-1 text-xl font-black">₹{Number(row.estimate || 0).toLocaleString("en-IN")}</div></div><div className="rounded-xl bg-emerald-50 p-4"><div className="text-xs text-slate-500">Advance</div><div className="mt-1 text-xl font-black">₹{Number(row.advanceAmount || 0).toLocaleString("en-IN")}</div></div></div><div className="mt-3 rounded-xl bg-amber-50 p-4"><div className="text-xs text-slate-500">Balance</div><div className="mt-1 text-xl font-black">₹{Number(row.balanceAmount || 0).toLocaleString("en-IN")}</div></div></section>
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6"><h2 className="text-lg font-extrabold">Status Timeline</h2><div className="mt-4 space-y-3">{(row.statusHistory ?? []).length ? row.statusHistory.map((h:any)=><div key={h.id} className="flex gap-3"><div className="mt-1"><CheckCircle2 size={17} className="text-emerald-600"/></div><div><div className="text-sm font-bold">{statusLabel[h.newStatus] || h.newStatus}</div><div className="text-xs text-slate-500">{new Date(h.changedAt).toLocaleString("en-IN")} · {h.changedBy?.name}</div>{h.note && <div className="mt-1 text-xs text-slate-600">{h.note}</div>}</div></div>) : <div className="text-sm text-slate-500">No status changes recorded yet.</div>}</div></section>
        <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:p-6"><h2 className="text-lg font-extrabold">Repair Notes</h2>{toast && <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{toast}</div>}<textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add technician / service note" className="mt-3 min-h-28 w-full rounded-xl border border-slate-300 p-3 text-sm"/><button onClick={()=>{patch({notes:note}); setNote("")}} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white"><Send size={16}/> Save Note</button></section>
      </div>
    </div>
  </div>;
}
