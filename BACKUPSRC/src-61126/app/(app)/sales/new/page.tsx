"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: string;
  name: string;
  sku: string;
  productType: string;
  variants: { id: string; name: string; sellingPrice: string | number }[];
};
type Customer = { id: string; name: string; phone: string };
type Branch = { id: string; name: string };
type Device = { id: string; imei1: string; imei2?: string | null; status?: string };
type CartItem = {
  key: string;
  productVariantId: string;
  name: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
  productType: string;
  serialDeviceIds: string[];
  devices: Device[];
};

export default function NewSale() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [emiProvider, setEmiProvider] = useState("Bajaj Finance");
  const [emiReference, setEmiReference] = useState("");
  const [emiTenure, setEmiTenure] = useState(12);
  const [emiAmount, setEmiAmount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const serialCache = useRef(new Map<string, { devices: Device[]; cachedAt: number }>());
  const serialRequests = useRef(new Map<string, Promise<Device[]>>());

  useEffect(() => {
    fetch("/api/sales/bootstrap", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message ?? "Unable to load POS data.");
        return data;
      })
      .then((data) => {
        setProducts(data.products ?? []);
        setCustomers(data.customers ?? []);
        setBranches(data.branches ?? []);
        const stored = localStorage.getItem("aamee_selected_branch");
        setBranchId(stored && stored !== "ALL" && data.branches?.some((b: Branch) => b.id === stored)
          ? stored
          : data.branches?.[0]?.id ?? "");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load POS data."));
  }, []);

  const visible = products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30);
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0), [cart]);

  async function loadAvailableDevices(branch: string, variantId: string) {
    const cacheKey = `${branch}:${variantId}`;
    const cached = serialCache.current.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < 30_000) return cached.devices;

    const existingRequest = serialRequests.current.get(cacheKey);
    if (existingRequest) return existingRequest;

    const request = fetch(
      `/api/serial-devices?branchId=${encodeURIComponent(branch)}&productVariantId=${encodeURIComponent(variantId)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.message ?? "Unable to load available IMEI devices.");
        const devices: Device[] = (data.devices ?? []).filter((d: Device) => d.status === "AVAILABLE");
        serialCache.current.set(cacheKey, { devices, cachedAt: Date.now() });
        return devices;
      })
      .finally(() => {
        serialRequests.current.delete(cacheKey);
      });

    serialRequests.current.set(cacheKey, request);
    return request;
  }

  async function add(product: Product, selectedVariant?: Product["variants"][number]) {
    const variant = selectedVariant ?? product.variants[0];
    if (!variant || !branchId) return;

    if (product.productType === "MOBILE") {
      try {
        const devices = await loadAvailableDevices(branchId, variant.id);
        const availableDevice = devices.find((d) => !cart.some((line) => line.serialDeviceIds.includes(d.id)));
        if (!availableDevice) {
          setError("No available IMEI device is remaining for this mobile variant.");
          return;
        }
        setCart((items) => [...items, {
          key: `${variant.id}-${availableDevice.id}`,
          productVariantId: variant.id,
          name: product.name,
          variantName: variant.name,
          unitPrice: Number(variant.sellingPrice),
          quantity: 1,
          productType: product.productType,
          serialDeviceIds: [availableDevice.id],
          devices,
        }]);
        setError("");
        return;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load available IMEI devices.");
        return;
      }
    }

    const existing = cart.find((item) => item.productVariantId === variant.id && item.productType !== "MOBILE");
    if (existing) {
      setCart((items) => items.map((item) => item.key === existing.key ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart((items) => [...items, {
        key: `${variant.id}-bulk`,
        productVariantId: variant.id,
        name: product.name,
        variantName: variant.name,
        unitPrice: Number(variant.sellingPrice),
        quantity: 1,
        productType: product.productType,
        serialDeviceIds: [],
        devices: [],
      }]);
    }
    setError("");
  }

  async function changeMobileDevice(key: string, deviceId: string) {
    const item = cart.find((x) => x.key === key);
    if (!item || !deviceId) return;
    if (cart.some((x) => x.key !== key && x.serialDeviceIds.includes(deviceId))) {
      setError("That IMEI is already selected in this sale.");
      return;
    }
    setCart((items) => items.map((x) => x.key === key ? { ...x, serialDeviceIds: [deviceId] } : x));
    setError("");
  }

  async function complete() {
    setError("");
    if (!branchId || !cart.length) return setError("Select a branch and add at least one item.");
    if (cart.some((item) => item.productType === "MOBILE" && item.serialDeviceIds.length !== 1)) return setError("Every mobile unit must have an IMEI selected.");
    if (method === "BAJAJ_EMI") {
      if (!customerId) return setError("Bajaj EMI requires a customer.");
      if (cart.length !== 1 || cart[0].quantity !== 1 || cart[0].serialDeviceIds.length !== 1) return setError("Bajaj EMI requires exactly one IMEI-tracked mobile device.");
      if (!emiReference.trim()) return setError("Enter the Bajaj application/reference number.");
    }

    setBusy(true);
    const response = await fetch("/api/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        branchId,
        customerId: customerId || undefined,
        items: cart.map((item) => ({
          productVariantId: item.productVariantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          serialDeviceIds: item.serialDeviceIds,
        })),
        payment: {
          method,
          amount: total,
          reference: reference || undefined,
          emi: method === "BAJAJ_EMI" ? {
            provider: emiProvider,
            applicationReference: emiReference,
            tenureMonths: emiTenure,
            emiAmount,
          } : undefined,
        },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) router.push(`/bills/${data.invoice.id}`);
    else setError(data.message ?? "Unable to complete sale");
    setBusy(false);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1.2fr_.9fr]">
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-2xl font-bold">New Sale</h1><p className="mt-1 text-sm text-slate-500">Sell stock from the selected branch.</p></div>
          <label className="text-sm font-medium">Branch<select value={branchId} onChange={(e) => { setBranchId(e.target.value); setCart([]); serialCache.current.clear(); serialRequests.current.clear(); }} className="mt-1 rounded-lg border p-2">{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} className="mt-5 w-full rounded-lg border p-3" placeholder="Search product or SKU" />
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {visible.map((p) => <div key={p.id} className="rounded-xl border p-3"><div className="font-semibold">{p.name}</div><div className="text-xs text-slate-500">{p.sku} • {p.productType}</div><div className="mt-2 space-y-2">{p.variants.map((variant) => <button key={variant.id} type="button" onClick={() => add(p, variant)} className="flex w-full items-center justify-between rounded-lg border bg-white px-3 py-2 text-left hover:bg-slate-50"><span className="text-sm">{variant.name}</span><span className="text-sm font-semibold text-blue-700">₹{Number(variant.sellingPrice).toLocaleString("en-IN")}</span></button>)}</div></div>)}
          {!visible.length && <div className="p-4 text-sm text-slate-500">No products found.</div>}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <label className="text-sm font-medium">Customer<select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-2 w-full rounded-lg border p-3"><option value="">Walk-in customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}</select></label>
        <div className="mt-4 space-y-2">
          {cart.map((item) => <div key={item.key} className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3"><div><div className="font-medium">{item.name}</div><div className="text-xs text-slate-500">{item.variantName} • {item.quantity} × ₹{item.unitPrice.toLocaleString("en-IN")}</div></div><button onClick={() => setCart((items) => items.filter((x) => x.key !== item.key))} className="text-xs text-red-600">Remove</button></div>
            {item.productType === "MOBILE" && <select value={item.serialDeviceIds[0] ?? ""} onChange={(e) => changeMobileDevice(item.key, e.target.value)} className="mt-3 w-full rounded-lg border p-2 text-sm"><option value="">Select IMEI</option>{item.devices.map((d) => <option key={d.id} value={d.id}>{d.imei1}{d.imei2 ? ` / ${d.imei2}` : ""}</option>)}</select>}
          </div>)}
          {!cart.length && <div className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">Cart is empty.</div>}
        </div>

        <div className="mt-5 border-t pt-4">
          <div className="flex justify-between text-lg font-bold"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{["CASH", "UPI", "BANK_TRANSFER", "BAJAJ_EMI"].map((m) => <button type="button" key={m} onClick={() => setMethod(m)} className={`rounded-lg border px-2 py-2 text-xs font-semibold ${method === m ? "border-blue-600 bg-blue-50 text-blue-700" : ""}`}>{m.replaceAll("_", " ")}</button>)}</div>
          {method !== "CASH" && <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-3 w-full rounded-lg border p-2" placeholder="Payment reference (optional)" />}
          {method === "BAJAJ_EMI" && <div className="mt-3 space-y-2 rounded-lg border p-3"><input value={emiProvider} onChange={(e) => setEmiProvider(e.target.value)} className="w-full rounded border p-2" placeholder="Provider" /><input value={emiReference} onChange={(e) => setEmiReference(e.target.value)} className="w-full rounded border p-2" placeholder="Bajaj application/reference" /><div className="grid grid-cols-2 gap-2"><input type="number" min={1} value={emiTenure} onChange={(e) => setEmiTenure(Number(e.target.value))} className="rounded border p-2" placeholder="Tenure" /><input type="number" min={0} value={emiAmount} onChange={(e) => setEmiAmount(Number(e.target.value))} className="rounded border p-2" placeholder="EMI amount" /></div></div>}
          {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button disabled={busy || !cart.length} onClick={complete} className="mt-4 w-full rounded-lg bg-blue-700 p-3 font-semibold text-white disabled:opacity-50">{busy ? "Completing..." : "Complete Sale"}</button>
        </div>
      </section>
    </div>
  );
}
