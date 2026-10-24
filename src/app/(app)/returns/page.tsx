"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, RotateCcw, Search, ShieldCheck } from "lucide-react";

type AnyRecord = any;
type ReturnForm = { branchId: string; saleId: string; reason: string };

const money = (value: unknown) => `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function ReturnsPage() {
  const [rows, setRows] = useState<AnyRecord[]>([]);
  const [sales, setSales] = useState<AnyRecord[]>([]);
  const [branches, setBranches] = useState<AnyRecord[]>([]);
  const [form, setForm] = useState<ReturnForm>({ branchId: "", saleId: "", reason: "" });
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadReturns = useCallback(async () => {
    const response = await fetch("/api/returns", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to load returns");
    setRows(data.returns ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [branchResponse, salesResponse] = await Promise.all([
          fetch("/api/branches", { cache: "no-store" }),
          fetch("/api/sales", { cache: "no-store" }),
        ]);
        const [branchData, salesData] = await Promise.all([branchResponse.json(), salesResponse.json()]);
        if (!branchResponse.ok) throw new Error(branchData.message || "Unable to load branches");
        if (!salesResponse.ok) throw new Error(salesData.message || "Unable to load sales");
        if (active) {
          setBranches(branchData.branches ?? []);
          setSales(salesData.sales ?? []);
          await loadReturns();
        }
      } catch (error) {
        if (active) setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to load return data" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [loadReturns]);

  const returnedQuantity = useMemo(() => {
    const totals = new Map<string, number>();
    for (const returnRow of rows) {
      if (!["COMPLETED", "APPROVED"].includes(returnRow.status)) continue;
      for (const item of returnRow.items ?? []) {
        const key = item.saleItemId ?? item.saleItem?.id;
        if (key) totals.set(key, (totals.get(key) ?? 0) + Number(item.quantity ?? 0));
      }
    }
    return totals;
  }, [rows]);

  const availableSales = useMemo(() => sales.filter((sale) => {
    if (sale.branch?.id !== form.branchId || sale.status === "CANCELLED" || sale.status === "RETURNED") return false;
    return (sale.items ?? []).some((item: AnyRecord) => Number(item.quantity) - (returnedQuantity.get(item.id) ?? 0) > 0);
  }), [sales, form.branchId, returnedQuantity]);

  const sale = sales.find((item) => item.id === form.saleId);
  const saleItems = (sale?.items ?? []).map((item: AnyRecord) => {
    const alreadyReturned = returnedQuantity.get(item.id) ?? 0;
    return { ...item, alreadyReturned, remaining: Math.max(0, Number(item.quantity) - alreadyReturned) };
  }).filter((item: AnyRecord) => item.remaining > 0);

  const chosenItems = saleItems.filter((item: AnyRecord) => selected[item.id] && Number(quantities[item.id] || 0) > 0 && Number(quantities[item.id]) <= item.remaining);
  const estimatedRefund = chosenItems.reduce((total: number, item: AnyRecord) => total + Number(item.unitPrice || 0) * Number(quantities[item.id]), 0);

  function changeBranch(branchId: string) {
    setForm({ branchId, saleId: "", reason: "" });
    setSelected({});
    setQuantities({});
    setNotice(null);
  }

  function changeSale(saleId: string) {
    setForm((current) => ({ ...current, saleId }));
    setSelected({});
    setQuantities({});
    setNotice(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (processing) return;
    if (!sale || chosenItems.length === 0) {
      setNotice({ type: "error", text: "Select at least one item and enter a valid return quantity." });
      return;
    }
    if (chosenItems.some((item: AnyRecord) => Number(quantities[item.id]) > item.remaining)) {
      setNotice({ type: "error", text: "Return quantity exceeds the remaining quantity." });
      return;
    }

    setProcessing(true);
    setNotice(null);
    try {
      const payload = {
        ...form,
        items: chosenItems.map((item: AnyRecord) => ({
          saleItemId: item.id,
          quantity: Number(quantities[item.id]),
          refundAmount: Number(item.unitPrice || 0) * Number(quantities[item.id]),
        })),
      };
      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Unable to process return");

      setNotice({ type: "success", text: `Return processed successfully. Refund total: ${money(data.return?.refundAmount ?? estimatedRefund)}.` });
      setForm((current) => ({ ...current, saleId: "", reason: "" }));
      setSelected({});
      setQuantities({});
      await Promise.all([loadReturns(), fetch("/api/sales", { cache: "no-store" }).then((r) => r.json()).then((d) => setSales(d.sales ?? []))]);
    } catch (error) {
      setNotice({ type: "error", text: error instanceof Error ? error.message : "Unable to process return" });
      await loadReturns().catch(() => undefined);
    } finally {
      setProcessing(false);
    }
  }

  const filteredRows = rows.filter((row) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return [row.sale?.invoice?.invoiceNumber, row.sale?.customer?.name, row.reason, row.status].some((value) => String(value ?? "").toLowerCase().includes(query));
  });

  return <main className="mx-auto w-full max-w-7xl space-y-5 pb-24 sm:space-y-6 lg:pb-8">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Sales management</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Returns & Warranty</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">Return only the selected items and quantities. Previously returned units are excluded automatically.</p>
      </div>
      <div className="flex w-fit items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><ShieldCheck size={16}/> Duplicate quantity checks enabled</div>
    </header>

    {notice && <div role="status" className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${notice.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
      {notice.type === "success" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0"/> : <AlertCircle size={18} className="mt-0.5 shrink-0"/>}<span>{notice.text}</span>
    </div>}

    <form onSubmit={submit} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-4 sm:px-6"><h2 className="text-base font-extrabold text-slate-900">Process a return</h2><p className="mt-1 text-xs text-slate-500">Choose a branch, select the original sale, then select the exact item quantity.</p></div>
      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">Branch
          <select required value={form.branchId} onChange={(event) => changeBranch(event.target.value)} disabled={processing} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option value="">Select branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">Original sale / invoice
          <select required value={form.saleId} onChange={(event) => changeSale(event.target.value)} disabled={!form.branchId || processing} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"><option value="">Select sale</option>{availableSales.map((item) => <option key={item.id} value={item.id}>{item.invoice?.invoiceNumber || item.id} · {item.customer?.name || "Walk-in"} · {money(item.total)}</option>)}</select>
        </label>
        <label className="block text-sm font-semibold text-slate-700 lg:col-span-2">Reason for return
          <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} maxLength={1000} placeholder="e.g. Faulty product, wrong item, customer return" disabled={processing} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/>
        </label>

        {form.saleId && <section className="lg:col-span-2">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="font-extrabold text-slate-900">Items eligible for return</h3><p className="text-xs text-slate-500">Select only the units being returned. The refund is calculated from the original sale price.</p></div><span className="text-sm font-bold text-slate-700">Selected refund: {money(estimatedRefund)}</span></div>
          <div className="space-y-3">
            {saleItems.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">All items on this sale have already been returned.</div>}
            {saleItems.map((item: AnyRecord) => {
              const title = [item.productVariant?.product?.name, item.productVariant?.name].filter(Boolean).join(" · ") || "Sale item";
              const checked = Boolean(selected[item.id]);
              return <div key={item.id} className={`grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(0,1fr)_120px_130px] sm:items-center sm:p-4 ${checked ? "border-blue-300 bg-blue-50/60" : "border-slate-200 bg-white"}`}>
                <label className="flex min-w-0 items-start gap-3"><input type="checkbox" checked={checked} disabled={processing} onChange={(event) => { setSelected((current) => ({ ...current, [item.id]: event.target.checked })); setQuantities((current) => ({ ...current, [item.id]: event.target.checked ? Math.min(1, item.remaining) : 0 })); }} className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"/><span className="min-w-0"><span className="block break-words text-sm font-bold text-slate-900">{title}</span><span className="mt-1 block text-xs text-slate-500">Original qty: {item.quantity} · Already returned: {item.alreadyReturned} · Remaining: {item.remaining}</span><span className="mt-1 block text-xs font-semibold text-slate-700">Unit price: {money(item.unitPrice)}</span></span></label>
                <label className="text-xs font-semibold text-slate-600">Return quantity<select value={checked ? (quantities[item.id] || 1) : 0} disabled={!checked || processing} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Number(event.target.value) }))} className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900"><option value={0}>0</option>{Array.from({ length: item.remaining }, (_: unknown, index: number) => index + 1).map((quantity: number) => <option key={quantity} value={quantity}>{quantity}</option>)}</select></label>
                <div className="rounded-lg bg-white/80 px-3 py-2 sm:text-right"><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Refund amount</div><div className="mt-0.5 font-extrabold text-slate-900">{money(checked ? Number(item.unitPrice || 0) * Number(quantities[item.id] || 0) : 0)}</div></div>
              </div>;
            })}
          </div>
        </section>}
      </div>
      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="text-sm text-slate-600">{chosenItems.length} item line{chosenItems.length === 1 ? "" : "s"} selected <span className="mx-1 text-slate-300">·</span><strong className="text-slate-900">Refund {money(estimatedRefund)}</strong></div>
        <button type="submit" disabled={processing || !form.branchId || !form.saleId || chosenItems.length === 0 || estimatedRefund <= 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50">{processing ? <><RotateCcw size={16} className="animate-spin"/> Processing return…</> : <><RotateCcw size={16}/> Process return</>}</button>
      </div>
    </form>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><h2 className="font-extrabold text-slate-900">Recent returns</h2><p className="mt-1 text-xs text-slate-500">Return history for your accessible branches.</p></div><label className="relative block w-full sm:max-w-xs"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice, customer, reason" className="min-h-10 w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"/></label></div>
      {loading ? <div className="p-8 text-center text-sm text-slate-500">Loading return history…</div> : filteredRows.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">No returns found.</div> : <>
        <div className="hidden overflow-x-auto md:block"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 text-left font-bold">Date</th><th className="px-5 py-3 text-left font-bold">Invoice</th><th className="px-5 py-3 text-left font-bold">Customer</th><th className="px-5 py-3 text-left font-bold">Status</th><th className="px-5 py-3 text-right font-bold">Refund</th><th className="px-5 py-3 text-left font-bold">Reason</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredRows.map((row) => <tr key={row.id} className="hover:bg-slate-50/70"><td className="whitespace-nowrap px-5 py-4 text-slate-600">{new Date(row.createdAt).toLocaleString("en-IN")}</td><td className="px-5 py-4 font-bold text-slate-900">{row.sale?.invoice?.invoiceNumber || row.saleId}</td><td className="px-5 py-4 text-slate-700">{row.sale?.customer?.name || "Walk-in customer"}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{row.status}</span></td><td className="px-5 py-4 text-right font-bold text-slate-900">{money(row.refundAmount)}</td><td className="max-w-xs px-5 py-4 text-slate-600">{row.reason || "—"}</td></tr>)}</tbody></table></div>
        <div className="divide-y divide-slate-100 md:hidden">{filteredRows.map((row) => <article key={row.id} className="space-y-2 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all text-sm font-extrabold text-slate-900">{row.sale?.invoice?.invoiceNumber || row.saleId}</p><p className="mt-0.5 text-xs text-slate-500">{row.sale?.customer?.name || "Walk-in customer"}</p></div><span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">{row.status}</span></div><div className="flex items-end justify-between gap-3"><div><p className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString("en-IN")}</p><p className="mt-1 text-xs text-slate-600">{row.reason || "No reason provided"}</p></div><p className="shrink-0 font-extrabold text-slate-900">{money(row.refundAmount)}</p></div></article>)}</div>
      </>}
    </section>
  </main>;
}
