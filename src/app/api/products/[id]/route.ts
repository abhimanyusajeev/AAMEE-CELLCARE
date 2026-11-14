import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, requireAuth, requireBranchAccess } from "@/lib/auth/session";
import { z } from "zod";

const Schema = z.object({
  name:z.string().trim().min(1).max(160),sku:z.string().trim().min(1).max(80),barcode:z.string().trim().max(80).optional().nullable(),brand:z.string().trim().max(100).optional().nullable(),categoryId:z.string().min(1),productType:z.enum(["MOBILE","ACCESSORY","SPARE_PART","SERVICE"]),variantId:z.string().min(1),variantName:z.string().trim().min(1).max(100),purchasePrice:z.coerce.number().finite().nonnegative(),sellingPrice:z.coerce.number().finite().nonnegative(),reorderLevel:z.coerce.number().int().nonnegative().default(0),isActive:z.boolean().default(true),warrantyName:z.string().trim().max(100).optional().or(z.literal("")),warrantyDays:z.coerce.number().int().nonnegative().default(0),stockBranchId:z.string().optional().or(z.literal("")),stockQuantity:z.coerce.number().int().nonnegative().optional()
});

export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}){
 const user=await requireAuth(request);const {id}=await context.params;
 const product=await prisma.product.findUnique({where:{id},include:{category:true,variants:{include:{warrantyPolicies:true,inventoryItems:{where:user.role==="OWNER"?{}:{branch:{assignments:{some:{userId:user.id}}}},include:{branch:{select:{id:true,name:true}}}}}}}});
 if(!product)return NextResponse.json({message:"Product not found"},{status:404});
 return NextResponse.json({product});
}

export async function PUT(request:NextRequest,context:{params:Promise<{id:string}>}){
 const user=await requireAuth(request);const {id}=await context.params;const parsed=Schema.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({message:"Invalid product input",issues:parsed.error.flatten()},{status:400});
 try{
  const d=parsed.data;
  if(d.stockQuantity!==undefined&&!d.stockBranchId&&d.productType!=="MOBILE"&&d.productType!=="SERVICE")return NextResponse.json({message:"Select a branch before updating stock quantity."},{status:400});
  if(d.stockBranchId)await requireBranchAccess(user.id,user.role,d.stockBranchId);
  const existing=await prisma.productVariant.findUnique({where:{id:d.variantId},include:{product:true,warrantyPolicies:true}});
  if(!existing||existing.productId!==id)return NextResponse.json({message:"Product variant not found."},{status:404});
  if(d.stockQuantity!==undefined&&d.stockBranchId&&d.productType==="MOBILE")return NextResponse.json({message:"Mobile quantities are managed through IMEI/serial devices."},{status:400});
  const product=await prisma.$transaction(async tx=>{
   const variant=await tx.productVariant.update({where:{id:d.variantId},data:{name:d.variantName,purchasePrice:d.purchasePrice,sellingPrice:d.sellingPrice,reorderLevel:d.reorderLevel}});
   if(d.warrantyName&&d.warrantyDays>0){
    const policy=existing.warrantyPolicies[0];
    if(policy)await tx.warrantyPolicy.update({where:{id:policy.id},data:{name:d.warrantyName,durationDays:d.warrantyDays}});
    else await tx.warrantyPolicy.create({data:{productVariantId:variant.id,name:d.warrantyName,durationDays:d.warrantyDays}});
    if(existing.warrantyPolicies.length>1)await tx.warrantyPolicy.deleteMany({where:{productVariantId:variant.id,id:{not:policy?.id}}});
   }else{await tx.warrantyPolicy.deleteMany({where:{productVariantId:variant.id}});}
   if(d.stockBranchId&&d.stockQuantity!==undefined){
    const current=await tx.inventoryItem.findUnique({where:{productVariantId_branchId:{productVariantId:variant.id,branchId:d.stockBranchId}}});
    const oldQty=current?.quantity??0;const delta=d.stockQuantity-oldQty;
    const inventory=await tx.inventoryItem.upsert({where:{productVariantId_branchId:{productVariantId:variant.id,branchId:d.stockBranchId}},update:{quantity:d.stockQuantity,reorderLevel:d.reorderLevel},create:{branchId:d.stockBranchId,productVariantId:variant.id,quantity:d.stockQuantity,reorderLevel:d.reorderLevel}});
    if(delta!==0)await tx.stockMovement.create({data:{branchId:d.stockBranchId,productVariantId:variant.id,quantity:delta,type:"MANUAL_ADJUSTMENT",note:"Stock quantity updated from product edit",createdById:user.id}});
    await tx.auditLog.create({data:{branchId:d.stockBranchId,actorId:user.id,action:"INVENTORY_ADJUSTED",entityType:"InventoryItem",entityId:inventory.id,metadata:{previousQuantity:oldQty,newQuantity:d.stockQuantity,delta,source:"PRODUCT_EDIT"}}});
   }
   return tx.product.update({where:{id},data:{name:d.name,sku:d.sku,barcode:d.barcode||null,brand:d.brand||null,categoryId:d.categoryId,productType:d.productType,isActive:d.isActive},include:{category:true,variants:{include:{warrantyPolicies:true,inventoryItems:{include:{branch:{select:{id:true,name:true}}}}}}}});
  });
  return NextResponse.json({product});
 }catch(error){if(error instanceof ForbiddenError)return NextResponse.json({message:"You do not have access to the selected branch."},{status:403});return NextResponse.json({message:error instanceof Error?error.message:"Unable to update product"},{status:400});}
}
