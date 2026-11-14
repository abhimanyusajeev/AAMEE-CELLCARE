import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/PageHeader";
import ProductList from "./ProductList";

export default async function Products() {
  await requireAuth();
  const products = await prisma.product.findMany({where:{isActive:true},include:{category:true,variants:{where:{isActive:true},take:1}},orderBy:{name:"asc"},take:500});
  const serializable = products.map(p=>({...p,variants:p.variants.map(v=>({...v,purchasePrice:Number(v.purchasePrice),sellingPrice:Number(v.sellingPrice),discount:Number(v.discount)}))}));
  return <div className="space-y-4"><PageHeader title="Products" subtitle="Manage your shared product catalogue, stock quantities and barcode stickers." action={<Link href="/products/new" className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">+ Add Product</Link>} /><ProductList products={serializable as any}/></div>;
}
