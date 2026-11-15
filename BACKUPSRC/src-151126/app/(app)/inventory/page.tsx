import {prisma} from "@/lib/db/prisma";
import {requireAuth} from "@/lib/auth/session";
import {InventoryManager} from "@/components/management/InventoryManager";
import {InventoryAlerts} from "@/components/management/InventoryAlerts";
export default async function Inventory(){
 const u=await requireAuth();
 const branches=u.role==="OWNER"?await prisma.branch.findMany({where:{isActive:true},orderBy:{name:"asc"},select:{id:true,name:true}}):await prisma.branch.findMany({where:{isActive:true,assignments:{some:{userId:u.id}}},orderBy:{name:"asc"},select:{id:true,name:true}});
 const branchIds=branches.map(b=>b.id);
 const [rows,variants,devices]=await Promise.all([
  prisma.inventoryItem.findMany({where:{branchId:{in:branchIds}},include:{branch:{select:{name:true}},productVariant:{select:{id:true,name:true,reorderLevel:true,product:{select:{name:true,sku:true,productType:true}}}}},orderBy:{updatedAt:"desc"},take:1000}),
  prisma.productVariant.findMany({where:{isActive:true,product:{isActive:true,productType:{not:"SERVICE"}}},select:{id:true,name:true,reorderLevel:true,product:{select:{name:true,sku:true,productType:true}}},orderBy:{product:{name:"asc"}}}),
  prisma.serialDevice.findMany({where:{branchId:{in:branchIds}},select:{id:true,branchId:true,imei1:true,imei2:true,serialNumber:true,ram:true,storage:true,color:true,status:true,branch:{select:{name:true}},productVariant:{select:{name:true,product:{select:{name:true,sku:true}}}}},orderBy:{createdAt:"desc"},take:500})
 ]);
 const stockMap=new Map(rows.map(r=>[`${r.branchId}:${r.productVariantId}`,r]));
 const all=branches.flatMap(branch=>variants.map(v=>({branch,variant:v,quantity:v.product.productType==="MOBILE"?devices.filter(d=>d.branchId===branch.id&&d.productVariant.product.sku===v.product.sku&&d.status==="AVAILABLE").length:(stockMap.get(`${branch.id}:${v.id}`)?.quantity??0),reorderLevel:stockMap.get(`${branch.id}:${v.id}`)?.reorderLevel??v.reorderLevel})));
 const out=all.filter(x=>x.quantity===0);const low=all.filter(x=>x.quantity>0&&x.quantity<=x.reorderLevel);
 return <div className="space-y-5"><InventoryAlerts out={out as any} low={low as any}/><InventoryManager branches={branches} variants={variants} initialRows={rows} devices={devices}/></div>;
}
