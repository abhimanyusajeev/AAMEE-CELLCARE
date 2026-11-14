"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Branch = { id: string; name: string };
type Variant = {
  id: string;
  name: string;
  reorderLevel: number;
  product: { name: string; sku: string; productType: string };
};
type Row = {
  id: string;
  branchId: string;
  productVariantId: string;
  quantity: number;
  reorderLevel: number;
  branch: { name: string };
  productVariant: Variant;
};
type Device = {
  id: string;
  branchId: string;
  imei1: string;
  imei2: string | null;
  serialNumber: string | null;
  ram: string | null;
  storage: string | null;
  color: string | null;
  status: string;
  branch: { name: string };
  productVariant: { name: string; product: { name: string; sku: string } };
};

const PAGE_SIZE = 10;

export function InventoryManager({
  branches,
  variants,
  initialRows,
  devices,
}: {
  branches: Branch[];
  variants: Variant[];
  initialRows: Row[];
  devices: Device[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [variantId, setVariantId] = useState("");
  const [variantSearch, setVariantSearch] = useState("");
  const [delta, setDelta] = useState("1");
  const [note, setNote] = useState("");
  const [serial, setSerial] = useState({
    imei1: "", imei2: "", serialNumber: "", ram: "", storage: "", color: "",
    purchasePrice: "", salePrice: "", warrantyText: "",
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [busy, setBusy] = useState(false);
  const [stockSearch, setStockSearch] = useState("");
  const [stockPage, setStockPage] = useState(1);

  const selected = useMemo(
    () => variants.find((variant) => variant.id === variantId),
    [variants, variantId]
  );

  const filteredVariants = useMemo(() => {
    const query = variantSearch.trim().toLowerCase();
    return variants
      .filter((variant) => variant.product.productType !== "SERVICE")
      .filter((variant) => !query ||
        `${variant.product.name} ${variant.name} ${variant.product.sku}`.toLowerCase().includes(query)
      );
  }, [variants, variantSearch]);

  const filteredRows = useMemo(() => {
    const query = stockSearch.trim().toLowerCase();
    return rows.filter((row) =>
      `${row.productVariant.product.name} ${row.productVariant.name} ${row.productVariant.product.sku} ${row.branch.name}`
        .toLowerCase().includes(query)
    );
  }, [rows, stockSearch]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(stockPage, pageCount);
  const paginatedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function showMessage(text: string, type: "success" | "error") {
    setMessage(text);
    setMessageType(type);
  }

  async function adjust() {
    const amount = Number(delta);
    if (!Number.isInteger(amount) || amount === 0) {
      showMessage("Enter a non-zero whole-number quantity change.", "error");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ branchId, productVariantId: variantId, delta: amount, note }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showMessage(data.message ?? "Unable to adjust stock.", "error");
        return;
      }
      const updated = data.inventory;
      const variant = variants.find((item) => item.id === variantId);
      const branch = branches.find((item) => item.id === branchId);
      if (updated && variant && branch) {
        setRows((previous) => {
          const existingIndex = previous.findIndex(
            (row) => row.productVariantId === variantId && row.branchId === branchId
          );
          const nextRow: Row = {
            id: updated.id,
            branchId,
            productVariantId: variantId,
            quantity: updated.quantity,
            reorderLevel: updated.reorderLevel,
            branch: { name: branch.name },
            productVariant: variant,
          };
          if (existingIndex >= 0) {
            return previous.map((row, index) => index === existingIndex ? nextRow : row);
          }
          return [nextRow, ...previous];
        });
      }
      showMessage("Product and stock updated successfully.", "success");
      setDelta("1");
      setNote("");
      router.refresh();
    } catch {
      showMessage("Unable to reach the server. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function addSerial() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/serial-devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          branchId,
          productVariantId: variantId,
          ...serial,
          purchasePrice: serial.purchasePrice ? Number(serial.purchasePrice) : undefined,
          salePrice: serial.salePrice ? Number(serial.salePrice) : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showMessage(data.message ?? "Unable to add device.", "error");
        return;
      }
      showMessage("IMEI device added to stock.", "success");
      setSerial({ imei1: "", imei2: "", serialNumber: "", ram: "", storage: "", color: "", purchasePrice: "", salePrice: "", warrantyText: "" });
      router.refresh();
    } catch {
      showMessage("Unable to reach the server. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory</h1>
        <p className="mt-1 text-slate-500">Branch stock, manual adjustments and IMEI-tracked mobile devices.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-bold">Stock adjustment</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium">Branch
              <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5">
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Search product / SKU / variant
              <input value={variantSearch} onChange={(event) => { setVariantSearch(event.target.value); setVariantId(""); }} placeholder="Type product name, SKU or variant..." className="mt-1 w-full rounded-lg border p-2.5" />
            </label>
            <label className="text-sm font-medium">Product / Variant
              <select value={variantId} onChange={(event) => setVariantId(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5">
                <option value="">Select product variant</option>
                {filteredVariants.map((variant) => <option key={variant.id} value={variant.id}>{variant.product.name} — {variant.name} ({variant.product.sku})</option>)}
              </select>
            </label>
            <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Mobile products must be added using IMEI/serial tracking below. Use adjustments for accessories and spare parts.</div>
            <label className="text-sm font-medium">Quantity change (+/-)
              <input type="number" step="1" value={delta} onChange={(event) => setDelta(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5" />
            </label>
            <label className="text-sm font-medium">Note
              <input value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5" placeholder="Opening stock / correction" />
            </label>
            <button type="button" disabled={busy || !branchId || !variantId || selected?.product.productType === "MOBILE"} onClick={() => void adjust()} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Apply adjustment"}</button>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="font-bold">Add mobile / IMEI device</h2>
          <div className="mt-4 grid gap-3">
            <label className="text-sm font-medium">Branch
              <select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5">
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">Mobile variant
              <select value={variantId} onChange={(event) => setVariantId(event.target.value)} className="mt-1 w-full rounded-lg border p-2.5">
                <option value="">Select mobile variant</option>
                {variants.filter((variant) => variant.product.productType === "MOBILE").map((variant) => <option key={variant.id} value={variant.id}>{variant.product.name} — {variant.name}</option>)}
              </select>
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              {([['imei1','IMEI 1'],['imei2','IMEI 2'],['serialNumber','Serial number'],['ram','RAM'],['storage','Storage'],['color','Color'],['purchasePrice','Purchase price'],['salePrice','Sale price'],['warrantyText','Warranty']] as const).map(([key, label]) => (
                <label key={key} className="text-sm font-medium">{label}<input required={key === "imei1"} value={serial[key]} onChange={(event) => setSerial({ ...serial, [key]: event.target.value })} className="mt-1 w-full rounded-lg border p-2.5" /></label>
              ))}
            </div>
            <button type="button" disabled={busy || !branchId || !variantId || selected?.product.productType !== "MOBILE"} onClick={() => void addSerial()} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Add device to stock"}</button>
          </div>
        </section>
      </div>

      {message && (
        <div role="status" className={`rounded-lg border p-3 text-sm font-semibold ${messageType === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {message}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="border-b p-4 font-bold">IMEI / Serial devices</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50"><tr>{["Product", "Variant", "Branch", "IMEI 1", "IMEI 2", "Serial", "Status"].map((heading) => <th key={heading} className="px-4 py-3 text-left">{heading}</th>)}</tr></thead>
            <tbody className="divide-y">{devices.map((device) => <tr key={device.id}><td className="px-4 py-3 font-semibold">{device.productVariant.product.name}</td><td className="px-4 py-3">{device.productVariant.name}</td><td className="px-4 py-3">{device.branch.name}</td><td className="px-4 py-3 font-mono">{device.imei1}</td><td className="px-4 py-3 font-mono">{device.imei2 || "—"}</td><td className="px-4 py-3">{device.serialNumber || "—"}</td><td className="px-4 py-3">{device.status}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-bold">Current stock</h2><p className="mt-1 text-xs text-slate-500">{filteredRows.length} matching stock records</p></div>
          <input value={stockSearch} onChange={(event) => { setStockSearch(event.target.value); setStockPage(1); }} placeholder="Search product, SKU, variant or branch..." className="w-full rounded-lg border px-3 py-2 text-sm sm:max-w-sm" />
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50"><tr>{["Product", "Variant", "Branch", "SKU", "Quantity", "Reorder", "Status"].map((heading) => <th key={heading} className="px-4 py-3 text-left">{heading}</th>)}</tr></thead>
            <tbody className="divide-y">
              {paginatedRows.map((row) => {
                const status = row.quantity === 0 ? "OUT_OF_STOCK" : row.quantity <= row.reorderLevel ? "LOW_STOCK" : "AVAILABLE";
                return <tr key={row.id}><td className="px-4 py-3 font-semibold">{row.productVariant.product.name}</td><td className="px-4 py-3">{row.productVariant.name}</td><td className="px-4 py-3">{row.branch.name}</td><td className="px-4 py-3">{row.productVariant.product.sku}</td><td className="px-4 py-3">{row.quantity}</td><td className="px-4 py-3">{row.reorderLevel}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${status === "OUT_OF_STOCK" ? "bg-rose-100 text-rose-700" : status === "LOW_STOCK" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{status.replaceAll("_", " ")}</span></td></tr>;
              })}
              {!paginatedRows.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No matching stock records found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Showing {filteredRows.length ? (safePage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}</p>
          <div className="flex items-center gap-2">
            <button type="button" disabled={safePage <= 1} onClick={() => setStockPage((page) => Math.max(1, page - 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Previous</button>
            <span className="text-sm tabular-nums">Page {safePage} of {pageCount}</span>
            <button type="button" disabled={safePage >= pageCount} onClick={() => setStockPage((page) => Math.min(pageCount, page + 1))} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">Next</button>
          </div>
        </div>
      </section>
    </div>
  );
}
