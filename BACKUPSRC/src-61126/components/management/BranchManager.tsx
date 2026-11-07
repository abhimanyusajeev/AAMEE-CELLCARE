"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Branch = {
  id: string; name: string; code: string; address: string; phone: string | null;
  email: string | null; invoicePrefix: string; isActive: boolean; createdAt: string;
};

const emptyForm = { name: "", code: "", address: "", phone: "", email: "", invoicePrefix: "" };

export function BranchManager({ initialBranches }: { initialBranches: Branch[] }) {
  const router = useRouter();
  const [branches, setBranches] = useState(initialBranches);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function startEdit(branch: Branch) {
    setEditingId(branch.id);
    setForm({ name: branch.name, code: branch.code, address: branch.address, phone: branch.phone ?? "", email: branch.email ?? "", invoicePrefix: branch.invoicePrefix });
    setMessage("");
  }

  function reset() { setEditingId(null); setForm(emptyForm); setMessage(""); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch(editingId ? `/api/branches/${editingId}` : "/api/branches", {
      method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(data.message ?? "Unable to save branch."); return; }
    if (editingId) setBranches((items) => items.map((item) => item.id === editingId ? { ...item, ...data.branch } : item));
    else setBranches((items) => [...items, data.branch]);
    reset(); router.refresh();
  }

  async function toggle(branch: Branch) {
    setMessage("");
    const response = await fetch(`/api/branches/${branch.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !branch.isActive }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.message ?? "Unable to update branch."); return; }
    setBranches((items) => items.map((item) => item.id === branch.id ? { ...item, isActive: data.branch.isActive } : item));
    router.refresh();
  }

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold text-slate-900">Branches</h1><p className="mt-1 text-slate-500">Manage shop locations and invoice prefixes.</p></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{["Branch","Code","Invoice Prefix","Contact","Status","Action"].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{branches.map((b) => <tr key={b.id}>
          <td className="px-4 py-4"><div className="font-semibold">{b.name}</div><div className="mt-1 text-xs text-slate-500">{b.address}</div></td>
          <td className="px-4 py-4 font-mono">{b.code}</td><td className="px-4 py-4 font-mono">{b.invoicePrefix}</td>
          <td className="px-4 py-4 text-xs">{b.phone || "—"}<br />{b.email || "—"}</td>
          <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${b.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{b.isActive ? "Active" : "Inactive"}</span></td>
          <td className="px-4 py-4"><div className="flex gap-2"><button type="button" onClick={() => startEdit(b)} className="text-blue-700">Edit</button><button type="button" onClick={() => void toggle(b)} className="text-slate-600">{b.isActive ? "Deactivate" : "Activate"}</button></div></td>
        </tr>)}</tbody></table>
      </div>
      <form onSubmit={submit} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-bold">{editingId ? "Edit branch" : "Add branch"}</h2>
        <div className="mt-4 space-y-3">{[["name","Branch name"],["code","Branch code"],["address","Address"],["phone","Phone"],["email","Email"],["invoicePrefix","Invoice prefix"]].map(([key,label]) => <label key={key} className="block text-sm font-medium text-slate-700">{label}<input required={!['phone','email'].includes(key)} type={key==='email'?'email':'text'} value={form[key as keyof typeof form]} disabled={editingId !== null && key==='code'} onChange={(e) => setForm((v) => ({...v,[key]:e.target.value}))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>)}</div>
        {message && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</div>}
        <div className="mt-4 flex gap-2"><button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : editingId ? "Save changes" : "Create branch"}</button>{editingId && <button type="button" onClick={reset} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>}</div>
      </form>
    </div>
  </div>;
}
