import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";

type Props={searchParams:Promise<{from?:string;to?:string;type?:string}>};
export default async function Transactions({searchParams}:Props){
 const u=await requireAuth(); const sp=await searchParams;
 const today=new Date(); const startDefault=new Date(today.getFullYear(),today.getMonth(),today.getDate());
 const from=sp.from?new Date(`${sp.from}T00:00:00`):startDefault; const to=sp.to?new Date(`${sp.to}T23:59:59.999`):new Date(today.getFullYear(),today.getMonth(),today.getDate(),23,59,59,999);
 const validFrom=!Number.isNaN(from.getTime())?from:startDefault; const validTo=!Number.isNaN(to.getTime())?to:new Date();
 const ids=(u.role==="OWNER"?await prisma.branch.findMany({where:{isActive:true},select:{id:true}}):await prisma.branch.findMany({where:{isActive:true,assignments:{some:{userId:u.id}}},select:{id:true}})).map(x=>x.id);
 const where:any={branchId:{in:ids},createdAt:{gte:validFrom,lte:validTo}}; if(sp.type)where.type=sp.type;
 const rows=await prisma.transaction.findMany({where,include:{branch:true},orderBy:{createdAt:"desc"}}); const total=rows.reduce((n,r)=>n+Number(r.amount),0);
 const day=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
 return <div className="space-y-4"><PageHeader title="Transactions" subtitle="Today's transactions are shown by default. Select a date range to review older entries."/>
 <form className="grid gap-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">From date<input name="from" type="date" defaultValue={sp.from||day(startDefault)} className="mt-1 w-full rounded-lg border p-2.5"/></label><label className="text-sm">To date<input name="to" type="date" defaultValue={sp.to||day(today)} className="mt-1 w-full rounded-lg border p-2.5"/></label><label className="text-sm">Transaction type<select name="type" defaultValue={sp.type||""} className="mt-1 w-full rounded-lg border p-2.5"><option value="">All types</option>{["SALE","SALE_RETURN","PURCHASE","EXPENSE","REPAIR_PAYMENT","STOCK_ADJUSTMENT","STOCK_TRANSFER"].map(t=><option key={t}>{t}</option>)}</select></label><div className="flex items-end gap-2"><button className="flex-1 rounded-lg bg-blue-700 p-2.5 font-semibold text-white">Apply filters</button><Link href="/transactions" className="rounded-lg border px-3 py-2.5 text-sm">Today</Link></div></form>
 <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white p-4 ring-1 ring-slate-200"><div className="text-xs text-slate-500">Transactions in selected period</div><div className="mt-1 text-2xl font-black">{rows.length}</div></div><div className="rounded-xl bg-white p-4 ring-1 ring-slate-200"><div className="text-xs text-slate-500">Total transaction amount</div><div className="mt-1 text-2xl font-black">₹{total.toLocaleString("en-IN")}</div></div></div>
 <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200"><table className="min-w-[760px] w-full text-sm"><thead className="bg-slate-50"><tr>{["Date","Type","Amount","Branch","Reference"].map(h=><th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody className="divide-y">{rows.map(r=><tr key={r.id}><td className="px-4 py-3">{r.createdAt.toLocaleString("en-IN")}</td><td className="px-4 py-3">{r.type}</td><td className="px-4 py-3 font-semibold">₹{Number(r.amount).toLocaleString("en-IN")}</td><td className="px-4 py-3">{r.branch.name}</td><td className="px-4 py-3">{r.referenceNo??r.referenceId??"-"}</td></tr>)}{!rows.length&&<tr><td colSpan={5} className="p-8 text-center text-slate-500">No transactions found for this date range.</td></tr>}</tbody></table></div></div>
}
