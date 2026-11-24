"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import Barcode from "./Barcode";

type Product = { id:string; name:string; sku:string; barcode:string|null; brand:string|null; productType:string; category:{name:string}; variants:{id:string;name:string;sellingPrice:any;reorderLevel:number}[] };
export default function ProductList({products}:{products:Product[]}) {
  const [query,setQuery]=useState("");
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return products;return products.filter(p=>[p.name,p.sku,p.barcode??"",p.brand??"",p.category?.name??"",p.productType].some(v=>v.toLowerCase().includes(q)) || p.variants.some(v=>v.name.toLowerCase().includes(q)));},[products,query]);
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><label className="block w-full sm:max-w-md"><span className="mb-1 block text-sm font-medium text-slate-700">Search products</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search name, SKU, barcode, brand or category" className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" /></label><p className="text-sm text-slate-500">{filtered.length} of {products.length} products</p></div>
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{["Product","SKU","Category","Type","Selling Price","Barcode sticker",""].map(h=><th key={h} className="px-4 py-3 text-left">{h}</th>)}</tr></thead><tbody className="divide-y">{filtered.map(p=>{const v=p.variants[0];return <tr key={p.id}><td className="px-4 py-3 font-medium">{p.name}</td><td className="px-4 py-3">{p.sku}</td><td className="px-4 py-3">{p.category?.name??"—"}</td><td className="px-4 py-3">{p.productType}</td><td className="px-4 py-3">₹{Number(v?.sellingPrice??0).toLocaleString("en-IN")}</td><td className="px-4 py-3"><Barcode value={p.barcode||p.sku} productName={p.name}/></td><td className="px-4 py-3 text-right"><Link className="text-blue-700 hover:underline" href={`/products/${p.id}/edit`}>Edit</Link></td></tr>})}{filtered.length===0&&<tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">No matching products found.</td></tr>}</tbody></table></div>
    <p className="text-xs text-slate-500">Sticker size: 50 × 25 mm (same as the compact Small Job Card). In the print dialog, choose your label printer or Save as PDF.</p>
  </div>;
}
