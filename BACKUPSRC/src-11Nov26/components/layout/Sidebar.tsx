"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, ShoppingCart, Boxes, Package, Users, Wrench, Truck, ShoppingBag, Receipt, BarChart3, ArrowLeftRight, Settings, UserCog, WalletCards, ClipboardList, X, Menu, MoreHorizontal } from "lucide-react";

const owner = [
  ["Dashboard", "/dashboard", LayoutDashboard], ["New Sale", "/sales/new", ShoppingCart], ["Sales", "/sales", Receipt], ["Bills", "/bills", Receipt], ["Products", "/products", Package], ["Categories", "/categories", Package], ["Inventory", "/inventory", Boxes], ["Stock Transfers", "/transfers", ArrowLeftRight], ["Purchases", "/purchases", ShoppingBag], ["Customers", "/customers", Users], ["Repairs", "/repairs", Wrench], ["Returns", "/returns", Receipt], ["Audit Logs", "/audit", ClipboardList], ["Suppliers", "/suppliers", Truck], ["Transactions", "/transactions", ArrowLeftRight], ["Expenses", "/expenses", WalletCards], ["Reports", "/reports", BarChart3], ["Users", "/users", UserCog], ["Branches", "/branches", Boxes], ["Settings", "/settings", Settings],
] as const;
const employeeHidden = new Set(["Expenses", "Reports", "Users", "Branches", "Settings", "Audit Logs"]);

function Nav({ role, onNavigate }: { role: "OWNER" | "EMPLOYEE"; onNavigate?: () => void }) {
  const path = usePathname();
  const items = role === "OWNER" ? owner : owner.filter(([label]) => !employeeHidden.has(label));
  return <nav className="space-y-1 overflow-y-auto pr-1">{items.map(([label, href, Icon]) => { const active = path === href || path.startsWith(`${href}/`); return <Link key={href} href={href} onClick={onNavigate} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-[#1872e7] text-white shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"}`}><Icon size={18} />{label}</Link>; })}</nav>;
}

function Brand() { return <div className="mb-5 rounded-2xl bg-white p-3"><Image src="/branding/aamee-cellcare-logo.png" alt="Aamee Cellcare logo" width={1030} height={490} priority className="mx-auto h-auto max-h-24 w-full object-contain"/><div className="mt-2 text-center text-[10px] font-semibold tracking-wide text-slate-500">AAMEE CELLCARE</div></div>; }

export function Sidebar({ role }: { role: "OWNER" | "EMPLOYEE" }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-label="Open navigation" onClick={() => setOpen(true)} className="fixed left-3 top-3 z-50 grid h-10 w-10 place-items-center rounded-xl bg-[#102d4b] text-white shadow-lg lg:hidden"><Menu size={20}/></button>
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-[#102d4b] text-white lg:block"><div className="flex h-full flex-col p-4"><Brand/><Nav role={role}/><div className="mt-auto pt-4 text-center text-[10px] tracking-[0.25em] text-white/40">KEEP YOUR WORLD CONNECTED</div></div></aside>
    {open && <div className="fixed inset-0 z-[60] lg:hidden"><button aria-label="Close navigation" className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]" onClick={() => setOpen(false)}/><aside className="relative flex h-full w-[86vw] max-w-80 flex-col bg-[#102d4b] p-4 text-white shadow-2xl"><div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><Brand/></div><button aria-label="Close navigation" onClick={() => setOpen(false)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"><X size={19}/></button></div><Nav role={role} onNavigate={() => setOpen(false)}/><div className="mt-auto pt-4 text-center text-[10px] tracking-[0.18em] text-white/40">AAMEE CELLCARE</div></aside></div>}
    <MobileNav onMore={() => setOpen(true)} />
  </>;
}

function MobileNav({ onMore }: { onMore: () => void }) {
  const path = usePathname();
  const links = [
    { label: "Home", href: "/dashboard", Icon: LayoutDashboard },
    { label: "New Sale", href: "/sales/new", Icon: ShoppingCart },
    { label: "Repairs", href: "/repairs", Icon: Wrench },
    { label: "Products", href: "/products", Icon: Package },
  ];
  return <nav aria-label="Quick navigation" className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
    {links.map(({ label, href, Icon }) => { const active = path === href || path.startsWith(`${href}/`); return <Link key={href} href={href} className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-bold ${active ? "text-blue-700" : "text-slate-500"}`}><span className={`grid h-7 w-10 place-items-center rounded-xl ${active ? "bg-blue-50" : ""}`}><Icon size={19}/></span><span className="max-w-full truncate">{label}</span></Link>; })}
    <button type="button" onClick={onMore} className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-bold text-slate-500"><span className="grid h-7 w-10 place-items-center rounded-xl"><MoreHorizontal size={21}/></span><span>More</span></button>
  </nav>;
}
