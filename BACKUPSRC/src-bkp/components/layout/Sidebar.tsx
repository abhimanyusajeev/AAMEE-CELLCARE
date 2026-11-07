"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, Boxes, Package, Users, Wrench, Truck, ShoppingBag, Receipt, BarChart3, ArrowLeftRight, Settings, UserCog, WalletCards, MessageCircle, ClipboardList } from "lucide-react";

const owner = [
  ["Dashboard", "/dashboard", LayoutDashboard], ["New Sale", "/sales/new", ShoppingCart], ["Sales", "/sales", Receipt], ["Bills", "/bills", Receipt], ["Products", "/products", Package], ["Categories", "/categories", Package], ["Inventory", "/inventory", Boxes], ["Stock Transfers", "/transfers", ArrowLeftRight], ["Purchases", "/purchases", ShoppingBag], ["Customers", "/customers", Users], ["Repairs", "/repairs", Wrench], ["Returns", "/returns", Receipt], ["Bajaj EMI", "/emi", WalletCards], ["WhatsApp", "/whatsapp", MessageCircle], ["Audit Logs", "/audit", ClipboardList], ["Suppliers", "/suppliers", Truck], ["Transactions", "/transactions", ArrowLeftRight], ["Expenses", "/expenses", WalletCards], ["Reports", "/reports", BarChart3], ["Users", "/users", UserCog], ["Branches", "/branches", Boxes], ["Settings", "/settings", Settings],
];

const employeeHidden = new Set(["Expenses", "Reports", "Users", "Branches", "Settings", "Audit Logs"]);

export function Sidebar({ role }: { role: "OWNER" | "EMPLOYEE" }) {
  const path = usePathname();
  const items = role === "OWNER" ? owner : owner.filter(([label]) => !employeeHidden.has(label as string));

  return <aside className="hidden w-64 shrink-0 bg-[#102d4b] text-white md:block"><div className="sticky top-0 flex h-screen flex-col p-4"><div className="mb-6 rounded-xl bg-white/10 p-4"><div className="text-xl font-extrabold tracking-tight">AAMEE CELLCARE</div><div className="mt-1 text-xs text-white/65">The Complete Digital Solutions</div></div><nav className="space-y-1 overflow-y-auto pr-1">{items.map(([label, href, Icon]) => { const active = path === href || path.startsWith(`${href}/`); const I = Icon as React.ComponentType<{ size?: number }>; return <Link key={href as string} href={href as string} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? "bg-[#1872e7]" : "text-white/80 hover:bg-white/10"}`}><I size={18} />{label as string}</Link>; })}</nav><div className="mt-auto pt-4 text-center text-[10px] tracking-[0.25em] text-white/45">KEEP YOUR WORLD CONNECTED</div></div></aside>;
}
