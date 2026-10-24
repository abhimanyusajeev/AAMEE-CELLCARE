"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  purchaseCount: number;
};

type FormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

export function SupplierManager({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialSuppliers);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((supplier) => {
      if (!showInactive && !supplier.isActive) return false;
      if (!q) return true;
      return [supplier.name, supplier.phone, supplier.email, supplier.address]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));
    });
  }, [items, search, showInactive]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setMessage("");
  }

  function startEdit(supplier: Supplier) {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      phone: supplier.phone ?? "",
      email: supplier.email ?? "",
      address: supplier.address ?? "",
      notes: supplier.notes ?? "",
    });
    setMessage("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(editingId ? `/api/suppliers/${editingId}` : "/api/suppliers", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone || undefined,
          email: form.email || undefined,
          address: form.address || undefined,
          notes: form.notes || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? "Unable to save supplier.");
        return;
      }

      const saved = {
        ...data.supplier,
        createdAt: new Date(data.supplier.createdAt).toISOString(),
        updatedAt: new Date(data.supplier.updatedAt).toISOString(),
        purchaseCount: editingId
          ? items.find((item) => item.id === editingId)?.purchaseCount ?? 0
          : 0,
      } as Supplier;

      if (editingId) {
        setItems((current) => current.map((item) => (item.id === editingId ? saved : item)));
      } else {
        setItems((current) => [saved, ...current]);
      }

      resetForm();
      router.refresh();
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(supplier: Supplier) {
    if (busy) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(`/api/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: !supplier.isActive }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data.message ?? "Unable to update supplier.");
        return;
      }

      setItems((current) =>
        current.map((item) =>
          item.id === supplier.id ? { ...item, isActive: data.supplier.isActive } : item,
        ),
      );
      router.refresh();
    } catch {
      setMessage("Unable to connect to the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Suppliers</h1>
        <p className="mt-1 text-slate-500">
          Manage suppliers used for purchases and procurement across Aamee Cellcare.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900">Supplier list</h2>
              <p className="text-xs text-slate-500">{filtered.length} supplier(s)</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search suppliers..."
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Show inactive
              </label>
            </div>
          </div>

          {message && (
            <div className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Purchases</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((supplier) => (
                  <tr key={supplier.id} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{supplier.name}</div>
                      {supplier.address && (
                        <div className="mt-1 max-w-xs text-xs text-slate-500">{supplier.address}</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div>{supplier.phone || "-"}</div>
                      <div className="text-xs text-slate-500">{supplier.email || "-"}</div>
                    </td>
                    <td className="px-4 py-4">{supplier.purchaseCount}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          supplier.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {supplier.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        className="mr-3 text-blue-700 hover:underline"
                        onClick={() => startEdit(supplier)}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-slate-600 hover:underline"
                        onClick={() => void toggleStatus(supplier)}
                        disabled={busy}
                      >
                        {supplier.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                      No suppliers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <form onSubmit={submit} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-900">
                {editingId ? "Edit supplier" : "Add supplier"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                GSTIN is intentionally not collected because GST is disabled for this project.
              </p>
            </div>
            {editingId && (
              <button type="button" onClick={resetForm} className="text-sm text-slate-500 hover:underline">
                Cancel
              </button>
            )}
          </div>

          <label className="mt-5 block text-sm font-medium">
            Supplier name
            <input
              required
              minLength={2}
              maxLength={160}
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="ABC Mobiles"
            />
          </label>

          <label className="mt-4 block text-sm font-medium">
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="9876543210"
            />
          </label>

          <label className="mt-4 block text-sm font-medium">
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="supplier@example.com"
            />
          </label>

          <label className="mt-4 block text-sm font-medium">
            Address
            <textarea
              value={form.address}
              onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
              className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Supplier address"
            />
          </label>

          <label className="mt-4 block text-sm font-medium">
            Notes
            <textarea
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              className="mt-2 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Optional notes"
            />
          </label>

          {message && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</div>
          )}

          <button
            disabled={busy}
            className="mt-5 w-full rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving..." : editingId ? "Save changes" : "Create supplier"}
          </button>
        </form>
      </div>
    </div>
  );
}
