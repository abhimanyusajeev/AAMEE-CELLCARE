import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { InventoryManager } from "@/components/management/InventoryManager";

export default async function Inventory() {
 const u=await requireAuth();
 const branches=u.role==="OWNER"
  ? await prisma.branch.findMany({where:{isActive:true},orderBy:{name:"asc"},select:{id:true,name:true}})
  : await prisma.branch.findMany({where:{isActive:true,assignments:{some:{userId:u.id}}},orderBy:{name:"asc"},select:{id:true,name:true}});
 const branchIds=branches.map(b=>b.id);
 const [rows,variants,devices]=await Promise.all([
  prisma.inventoryItem.findMany({where:{branchId:{in:branchIds}},include:{branch:{select:{name:true}},productVariant:{select:{id:true,name:true,reorderLevel:true,product:{select:{name:true,sku:true,productType:true}}}}},orderBy:{updatedAt:"desc"},take:1000}),
  prisma.productVariant.findMany({where:{isActive:true,product:{isActive:true,productType:{not:"SERVICE"}}},select:{id:true,name:true,reorderLevel:true,product:{select:{name:true,sku:true,productType:true}}},orderBy:{product:{name:"asc"}}}),
  prisma.serialDevice.findMany({where:{branchId:{in:branchIds}},select:{id:true,branchId:true,imei1:true,imei2:true,serialNumber:true,ram:true,storage:true,color:true,status:true,branch:{select:{name:true}},productVariant:{select:{name:true,product:{select:{name:true,sku:true}}}}},orderBy:{createdAt:"desc"},take:500})
 ]);
 const stockMap=new Map(rows.map(r=>[`${r.branchId}:${r.productVariantId}`,r]));
 const all=branches.flatMap(branch=>variants.map(v=>({branch,variant:v,quantity:v.product.productType==="MOBILE"?devices.filter(d=>d.branchId===branch.id&&d.productVariant.product.sku===v.product.sku&&d.status==="AVAILABLE").length:(stockMap.get(`${branch.id}:${v.id}`)?.quantity??0),reorderLevel:stockMap.get(`${branch.id}:${v.id}`)?.reorderLevel??v.reorderLevel})));
 const out=all.filter(x=>x.quantity===0);
 const low=all.filter(x=>x.quantity>0&&x.quantity<=x.reorderLevel);
 const alerts=(items:typeof all,title:string,style:string)=><section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><h2 className={`font-bold ${style}`}>{title} ({items.length})</h2><div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-slate-50"><tr>{["Product","SKU","Variant","Branch","Available","Reorder level"].map(x=><th key={x} className="px-3 py-2 text-left">{x}</th>)}</tr></thead><tbody className="divide-y">{items.map(x=><tr key={`${x.branch.id}:${x.variant.id}`}><td className="px-3 py-2 font-medium">{x.variant.product.name}</td><td className="px-3 py-2">{x.variant.product.sku}</td><td className="px-3 py-2">{x.variant.name}</td><td className="px-3 py-2">{x.branch.name}</td><td className="px-3 py-2 font-bold">{x.quantity}</td><td className="px-3 py-2">{x.reorderLevel}</td></tr>)}{!items.length&&<tr><td colSpan={6} className="px-3 py-5 text-center text-slate-500">No products in this category.</td></tr>}</tbody></table></div></section>;
 return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-rose-200 bg-rose-50 p-4"><div className="text-sm font-semibold text-rose-800">Out of stock</div><div className="mt-1 text-3xl font-black text-rose-900">{out.length}</div><p className="text-xs text-rose-700">Includes products with no inventory record.</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-sm font-semibold text-amber-800">Low stock alerts</div><div className="mt-1 text-3xl font-black text-amber-900">{low.length}</div><p className="text-xs text-amber-700">Available quantity is at or below reorder level.</p></div></div>{alerts(out,"Out of stock products","text-rose-700")}{alerts(low,"Low stock products","text-amber-700")}<InventoryManager branches={branches} variants={variants} initialRows={rows} devices={devices}/></div>;
}
