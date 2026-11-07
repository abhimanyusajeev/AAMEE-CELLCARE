"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Sale = {
  id: string;
  createdAt: string;
  total: string | number;
  status: string;
  branch: { name: string };
  customer?: { name: string; phone: string } | null;
  createdBy: { name: string };
  invoice?: { id: string; invoiceNumber: string } | null;
  payments: { method: string; amount: string | number }[];
};

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/sales")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message ?? "Unable to load sales");
        return data;
      })
      .then((data) => setSales(data.sales ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((sale) => `${sale.invoice?.invoiceNumber ?? ""} ${sale.customer?.name ?? ""} ${sale.customer?.phone ?? ""} ${sale.branch.name}`.toLowerCase().includes(q));
  }, [sales, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Sales</h1>
          <p className="mt-1 text-slate-500">Sales history for the branches you are allowed to access.</p>
        </div>
        <Link href="/sales/new" className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">New Sale</Link>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search invoice, customer, phone or branch" className="w-full rounded-lg border p-3" />
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        {loading ? <div className="p-6 text-slate-500">Loading sales...</div> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50"><tr>{["Invoice","Date","Branch","Customer","Payment","Total","Status","Action"].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
              <tbody className="divide-y">
                {filtered.map((sale) => <tr key={sale.id}>
                  <td className="px-4 py-3 font-semibold">{sale.invoice?.invoiceNumber ?? "—"}</td>
                  <td className="px-4 py-3">{new Date(sale.createdAt).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">{sale.branch.name}</td>
                  <td className="px-4 py-3">{sale.customer?.name ?? "Walk-in"}</td>
                  <td className="px-4 py-3">{sale.payments[0]?.method?.replaceAll("_", " ") ?? "—"}</td>
                  <td className="px-4 py-3 font-semibold">₹{Number(sale.total).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3">{sale.status}</td>
                  <td className="px-4 py-3">{sale.invoice ? <Link href={`/bills/${sale.invoice.id}`} className="text-blue-700">View bill</Link> : "—"}</td>
                </tr>)}
                {!filtered.length && <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">No sales found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
