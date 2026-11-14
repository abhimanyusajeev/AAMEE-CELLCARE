"use client";

import { useEffect, useMemo, useState } from "react";

type Product = { id: string; name: string; sku: string; productType: string; variants: { id: string; name: string; purchasePrice: number | string }[] };
type Supplier = { id: string; name: string; phone?: string | null };
type Branch = { id: string; name: string };
type Line = { productVariantId: string; productName: string; productType: string; quantity: number; unitPrice: number; imeis: string };

export default function PurchasesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [imeis, setImeis] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newSupplier, setNewSupplier] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/products").then((r) => r.json()),
      fetch("/api/suppliers").then((r) => r.json()),
      fetch("/api/branches").then((r) => r.json()),
    ]).then(([p, s, b]) => {
      setProducts(p.products ?? []);
      setSuppliers(s.suppliers ?? []);
      setBranches(b.branches ?? []);
      const stored = localStorage.getItem("aamee_selected_branch");
      setBranchId(stored && stored !== "ALL" ? stored : b.branches?.[0]?.id ?? "");
    });
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedVariant = selectedProduct?.variants[0];
  const total = useMemo(() => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0), [lines]);

  function chooseProduct(id: string) {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    setUnitPrice(Number(p?.variants[0]?.purchasePrice ?? 0));
    setImeis("");
  }

  function addLine() {
    if (!selectedProduct || !selectedVariant || quantity < 1 || unitPrice < 0) return;
    const parsedImeis = imeis.split(/\r?\n|,/).map((x) => x.trim()).filter(Boolean);
    if (selectedProduct.productType === "MOBILE" && parsedImeis.length && parsedImeis.length !== quantity) {
      setMessage("For mobile purchases, enter exactly one IMEI per unit or leave IMEI blank.");
      return;
    }
    setLines((current) => [...current, { productVariantId: selectedVariant.id, productName: selectedProduct.name, productType: selectedProduct.productType, quantity, unitPrice, imeis: parsedImeis.join("\n") }]);
    setProductId("");
    setQuantity(1);
    setUnitPrice(0);
    setImeis("");
    setMessage("");
  }

  async function submit() {
    if (!branchId || !supplierId || !lines.length) return setMessage("Select a branch, supplier and at least one item.");
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/purchases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        branchId,
        supplierId,
        invoiceNumber: invoiceNumber || undefined,
        items: lines.map((line) => ({ productVariantId: line.productVariantId, quantity: line.quantity, unitPrice: line.unitPrice, imeis: line.imeis.split(/\r?\n/).filter(Boolean) })),
      }),
    });
    const data = await response.json();
    if (!response.ok) setMessage(data.message ?? "Unable to save purchase");
    else {
      setMessage("Purchase recorded and stock updated.");
      setLines([]);
      setInvoiceNumber("");
    }
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <div><h1 className="text-3xl font-bold">Purchases</h1><p className="mt-1 text-slate-500">Receive stock into a branch and create immutable stock movements.</p></div>
      <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">Branch<select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mt-2 w-full rounded-lg border p-3">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label className="text-sm font-medium">Supplier<select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="mt-2 w-full rounded-lg border p-3"><option value="">Select supplier</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="text-sm font-medium">Supplier invoice number<input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="mt-2 w-full rounded-lg border p-3" /></label>
            <div className="sm:col-span-2 flex gap-2"><input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} className="flex-1 rounded-lg border p-3" placeholder="New supplier name" /><button type="button" onClick={async () => { if (!newSupplier.trim()) return; const r = await fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newSupplier.trim() }) }); const d = await r.json(); if (r.ok) { setSuppliers((items) => [...items, d.supplier]); setSupplierId(d.supplier.id); setNewSupplier(""); } else setMessage(d.message ?? "Unable to create supplier"); }} className="rounded-lg border px-4 font-semibold">Add Supplier</button></div>
          </div>
          <div className="mt-6 rounded-xl border p-4">
            <h2 className="font-semibold">Add stock</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select value={productId} onChange={(e) => chooseProduct(e.target.value)} className="rounded-lg border p-3"><option value="">Select product</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="rounded-lg border p-3" placeholder="Quantity" />
              <input type="number" min={0} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} className="rounded-lg border p-3" placeholder="Purchase price" />
              {selectedProduct?.productType === "MOBILE" && <textarea value={imeis} onChange={(e) => setImeis(e.target.value)} className="min-h-24 rounded-lg border p-3" placeholder="Optional: one IMEI per line" />}
            </div>
            <button type="button" onClick={addLine} className="mt-3 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Add to purchase</button>
          </div>
        </section>
        <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <h2 className="text-xl font-bold">Purchase Summary</h2>
          <div className="mt-4 space-y-2">{lines.map((line, index) => <div key={`${line.productVariantId}-${index}`} className="rounded-lg bg-slate-50 p-3"><div className="font-medium">{line.productName}</div><div className="text-sm text-slate-500">{line.quantity} × ₹{line.unitPrice.toLocaleString("en-IN")}</div>{line.imeis && <div className="mt-1 text-xs text-slate-500">IMEIs: {line.imeis.split("\n").join(", ")}</div>}</div>)}{!lines.length && <p className="text-sm text-slate-500">No items added yet.</p>}</div>
          <div className="mt-5 border-t pt-4 flex justify-between text-xl font-bold"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
          {message && <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm">{message}</p>}
          <button disabled={busy || !lines.length} onClick={submit} className="mt-4 w-full rounded-lg bg-blue-700 p-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving..." : "Record Purchase"}</button>
        </section>
      </div>
    </div>
  );
}
