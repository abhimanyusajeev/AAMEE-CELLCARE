"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, ShoppingCart, Boxes, Package, Users, Wrench, Truck, ShoppingBag, Receipt, BarChart3, ArrowLeftRight, Settings, UserCog, WalletCards, MessageCircle, ClipboardList, X, Menu } from "lucide-react";

const owner = [
  ["Dashboard", "/dashboard", LayoutDashboard], ["New Sale", "/sales/new", ShoppingCart], ["Sales", "/sales", Receipt], ["Bills", "/bills", Receipt], ["Products", "/products", Package], ["Categories", "/categories", Package], ["Inventory", "/inventory", Boxes], ["Stock Transfers", "/transfers", ArrowLeftRight], ["Purchases", "/purchases", ShoppingBag], ["Customers", "/customers", Users], ["Repairs", "/repairs", Wrench], ["Returns", "/returns", Receipt], ["Bajaj EMI", "/emi", WalletCards], ["WhatsApp", "/whatsapp", MessageCircle], ["Audit Logs", "/audit", ClipboardList], ["Suppliers", "/suppliers", Truck], ["Transactions", "/transactions", ArrowLeftRight], ["Expenses", "/expenses", WalletCards], ["Reports", "/reports", BarChart3], ["Users", "/users", UserCog], ["Branches", "/branches", Boxes], ["Settings", "/settings", Settings],
] as const;
const employeeHidden = new Set(["Expenses", "Reports", "Users", "Branches", "Settings", "Audit Logs"]);

function Nav({ role, onNavigate }: { role: "OWNER" | "EMPLOYEE"; onNavigate?: () => void }) {
  const path = usePathname();
  const items = role === "OWNER" ? owner : owner.filter(([label]) => !employeeHidden.has(label));
  return <nav className="space-y-1 overflow-y-auto pr-1">{items.map(([label, href, Icon]) => { const active = path === href || path.startsWith(`${href}/`); return <Link key={href} href={href} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-[#1872e7] text-white shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"}`}><Icon size={18} />{label}</Link>; })}</nav>;
}

function Brand() { return <div className="mb-5 rounded-2xl bg-white/10 p-4"><div className="text-xl font-black tracking-tight">AAMEE CELLCARE</div><div className="mt-1 text-xs text-white/60">The Complete Digital Solutions</div></div>; }

export function Sidebar({ role }: { role: "OWNER" | "EMPLOYEE" }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-label="Open navigation" onClick={() => setOpen(true)} className="fixed left-3 top-3 z-50 grid h-10 w-10 place-items-center rounded-xl bg-[#102d4b] text-white shadow-lg lg:hidden"><Menu size={20}/></button>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-[#102d4b] text-white lg:block"><div className="flex h-full flex-col p-4"><Brand/><Nav role={role}/><div className="mt-auto pt-4 text-center text-[10px] tracking-[0.25em] text-white/40">KEEP YOUR WORLD CONNECTED</div></div></aside>
    {open && <div className="fixed inset-0 z-[60] lg:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-slate-950/50" onClick={() => setOpen(false)}/><aside className="relative flex h-full w-[82vw] max-w-80 flex-col bg-[#102d4b] p-4 text-white shadow-2xl"><div className="flex items-center justify-between"><div className="flex-1"><Brand/></div><button aria-label="Close navigation" onClick={() => setOpen(false)} className="mb-5 ml-2 grid h-9 w-9 place-items-center rounded-lg bg-white/10"><X size={19}/></button></div><Nav role={role} onNavigate={() => setOpen(false)}/><div className="mt-auto pt-4 text-center text-[10px] tracking-[0.25em] text-white/40">KEEP YOUR WORLD CONNECTED</div></aside></div>}
  </>;
}
