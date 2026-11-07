"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Customer = {
  id: string; name: string; phone: string; alternatePhone: string | null; email: string | null;
  address: string | null; notes: string | null; createdAt: string; updatedAt: string;
  _count?: { sales: number; repairs: number; visits: number };
};

type FormState = { name: string; phone: string; alternatePhone: string; email: string; address: string; notes: string };
const emptyForm: FormState = { name: "", phone: "", alternatePhone: "", email: "", address: "", notes: "" };

export function CustomerManager({ initialCustomers }: { initialCustomers: Customer[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialCustomers);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((c) => [c.name, c.phone, c.alternatePhone, c.email, c.address].filter(Boolean).some((v) => v!.toLowerCase().includes(q)));
  }, [items, search]);

  function reset() { setForm(emptyForm); setEditingId(null); setMessage(""); }
  function edit(c: Customer) {
    setEditingId(c.id);
    setForm({ name:c.name, phone:c.phone, alternatePhone:c.alternatePhone ?? "", email:c.email ?? "", address:c.address ?? "", notes:c.notes ?? "" });
    setMessage("");
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setMessage("");
    try {
      const r = await fetch(editingId ? `/api/customers/${editingId}` : "/api/customers", {
        method: editingId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMessage(d.message ?? "Unable to save customer."); return; }
      const saved = d.customer as Customer;
      if (editingId) setItems((cur) => cur.map((x) => x.id === editingId ? { ...x, ...saved } : x));
      else setItems((cur) => [{ ...saved, _count: { sales:0, repairs:0, visits:0 } }, ...cur]);
      reset(); router.refresh();
    } catch { setMessage("Unable to connect to the server."); }
    finally { setBusy(false); }
  }

  async function remove(c: Customer) {
    if (busy) return;
    if (!window.confirm(`Delete ${c.name}? Customers with history cannot be deleted.`)) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch(`/api/customers/${c.id}`, { method: "DELETE" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMessage(d.message ?? "Unable to delete customer."); return; }
      setItems((cur) => cur.filter((x) => x.id !== c.id));
      if (editingId === c.id) reset();
      router.refresh();
    } catch { setMessage("Unable to connect to the server."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold text-slate-900">Customers</h1><p className="mt-1 text-slate-500">Customer master shared across both Aamee Cellcare branches.</p></div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Customer list</h2><p className="text-xs text-slate-500">{filtered.length} customer(s)</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, email..." className="rounded-lg border px-3 py-2 text-sm"/></div>
        {message && <div className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</div>}
        <div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{["Customer","Contact","Sales","Repairs","Visits","Actions"].map(h=><th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody className="divide-y">
          {filtered.map(c=><tr key={c.id} className="align-top"><td className="px-4 py-4"><Link href={`/customers/${c.id}`} className="font-semibold text-blue-700 hover:underline">{c.name}</Link>{c.address&&<div className="mt-1 max-w-xs text-xs text-slate-500">{c.address}</div>}</td><td className="px-4 py-4">{c.phone}<div className="text-xs text-slate-500">{c.email??"-"}</div></td><td className="px-4 py-4">{c._count?.sales??0}</td><td className="px-4 py-4">{c._count?.repairs??0}</td><td className="px-4 py-4">{c._count?.visits??0}</td><td className="px-4 py-4 whitespace-nowrap"><button className="mr-3 text-blue-700" disabled={busy} onClick={()=>edit(c)}>Edit</button><button className="text-red-600" disabled={busy} onClick={()=>void remove(c)}>Delete</button></td></tr>)}
          {filtered.length===0&&<tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No customers found.</td></tr>}
        </tbody></table></div>
      </section>
      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"><div className="flex items-center justify-between"><div><h2 className="font-bold">{editingId?"Edit customer":"Add customer"}</h2><p className="text-xs text-slate-500">Keep customer identity details accurate for billing and repairs.</p></div>{editingId&&<button onClick={reset} className="text-sm text-slate-500">Cancel</button>}</div>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Name" value={form.name} onChange={v=>setForm({...form,name:v})} required/><Field label="Phone" value={form.phone} onChange={v=>setForm({...form,phone:v})} required/><Field label="Alternate phone" value={form.alternatePhone} onChange={v=>setForm({...form,alternatePhone:v})}/><Field label="Email" type="email" value={form.email} onChange={v=>setForm({...form,email:v})}/><Field label="Address" value={form.address} onChange={v=>setForm({...form,address:v})}/><label className="block text-sm font-medium">Notes<textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} className="mt-2 min-h-24 w-full rounded-lg border p-3"/></label>
          <button disabled={busy} className="w-full rounded-lg bg-blue-700 p-3 font-semibold text-white disabled:opacity-60">{busy?"Saving...":editingId?"Update customer":"Add customer"}</button>
        </form>
      </section>
    </div>
  </div>;
}
function Field({label,value,onChange,type="text",required=false}:{label:string;value:string;onChange:(v:string)=>void;type?:string;required?:boolean}){return <label className="block text-sm font-medium">{label}<input type={type} value={value} onChange={e=>onChange(e.target.value)} required={required} className="mt-2 w-full rounded-lg border p-3"/></label>}
