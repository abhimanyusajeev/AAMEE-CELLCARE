"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

type Branch = { id: string; name: string; code: string };
type User = { id: string; name: string; email: string | null; phone: string | null; role: "OWNER" | "EMPLOYEE"; isActive: boolean; branchAssignments: { branch: Branch }[] };
const emptyForm = { name: "", email: "", phone: "", password: "", branchIds: [] as string[] };

export function UserManager({ currentUserId, initialUsers, branches }: { currentUserId: string; initialUsers: User[]; branches: Branch[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const employees = users.filter((user) => user.role === "EMPLOYEE");
  function reset() { setEditingId(null); setForm(emptyForm); setShowPassword(false); setMessage(""); }
  function startEdit(user: User) { setEditingId(user.id); setForm({ name: user.name, email: user.email ?? "", phone: user.phone ?? "", password: "", branchIds: user.branchAssignments.map((a) => a.branch.id) }); setMessage(""); }
  function toggleBranch(id: string) { setForm((v) => ({ ...v, branchIds: v.branchIds.includes(id) ? v.branchIds.filter((x) => x !== id) : [...v.branchIds, id] })); }

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const payload = { ...form, ...(editingId && !form.password ? { password: undefined } : {}) };
    const response = await fetch(editingId ? `/api/users/${editingId}` : "/api/users", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(data.message ?? "Unable to save employee."); return; }
    if (editingId) {
      const branchesForUser = form.branchIds.map((id) => ({ branch: branches.find((b) => b.id === id)! }));
      setUsers((items) => items.map((u) => u.id === editingId ? { ...u, ...data.user, branchAssignments: branchesForUser } : u));
    } else {
      const created = { ...data.user, branchAssignments: form.branchIds.map((id) => ({ branch: branches.find((b) => b.id === id)! })) };
      setUsers((items) => [...items, created]);
    }
    reset(); router.refresh();
  }

  async function toggleActive(user: User) {
    setMessage("");
    const response = await fetch(`/api/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !user.isActive }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setMessage(data.message ?? "Unable to update employee."); return; }
    setUsers((items) => items.map((u) => u.id === user.id ? { ...u, isActive: data.user.isActive } : u));
    router.refresh();
  }

  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold text-slate-900">Users & Access</h1><p className="mt-1 text-slate-500">Create employee accounts and control their assigned shops.</p></div>
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
        <table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{["Employee","Contact","Assigned branches","Status","Action"].map((h) => <th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead>
        <tbody className="divide-y">
          {users.filter((u) => u.id === currentUserId).map((u) => <tr key={u.id}><td className="px-4 py-4"><div className="font-semibold">{u.name}</div><div className="text-xs text-slate-500">OWNER</div></td><td className="px-4 py-4 text-xs">{u.email || "—"}</td><td className="px-4 py-4">All active branches</td><td className="px-4 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Active</span></td><td className="px-4 py-4 text-slate-400">Owner</td></tr>)}
          {employees.map((u) => <tr key={u.id}><td className="px-4 py-4"><div className="font-semibold">{u.name}</div><div className="text-xs text-slate-500">EMPLOYEE</div></td><td className="px-4 py-4 text-xs">{u.email || "—"}<br />{u.phone || "—"}</td><td className="px-4 py-4 text-xs">{u.branchAssignments.map((a) => a.branch.name).join(", ") || "No branch"}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{u.isActive ? "Active" : "Inactive"}</span></td><td className="px-4 py-4"><div className="flex gap-2"><button type="button" onClick={() => startEdit(u)} className="text-blue-700">Edit</button><button type="button" onClick={() => void toggleActive(u)} className="text-slate-600">{u.isActive ? "Deactivate" : "Activate"}</button></div></td></tr>)}
        </tbody></table>
      </div>
      <form onSubmit={submit} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <h2 className="font-bold">{editingId ? "Edit employee" : "Add employee"}</h2>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
          <label className="block text-sm font-medium">Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
          <label className="block text-sm font-medium">Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
          <label className="block text-sm font-medium">{editingId ? "New password (optional)" : "Password"}<div className="relative mt-1"><input required={!editingId} minLength={12} type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border px-3 py-2 pr-11" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></label>
          <fieldset><legend className="text-sm font-medium">Assigned branches</legend><div className="mt-2 space-y-2">{branches.map((b) => <label key={b.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.branchIds.includes(b.id)} onChange={() => toggleBranch(b.id)} />{b.name}</label>)}</div></fieldset>
        </div>
        {message && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{message}</div>}
        <div className="mt-4 flex gap-2"><button disabled={busy} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : editingId ? "Save changes" : "Create employee"}</button>{editingId && <button type="button" onClick={reset} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>}</div>
      </form>
    </div>
  </div>;
}
