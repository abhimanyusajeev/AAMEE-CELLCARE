import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireBranchAccess } from "@/lib/auth/session";
import { buildWhatsAppLink, normalizeWhatsAppPhone } from "@/lib/whatsapp";

const Schema = z.object({ branchId:z.string(), customerId:z.string().optional(), deviceType:z.enum(["MOBILE","LAPTOP","TABLET","OTHER"]), serviceType:z.enum(["REPAIR","SERVICE","UPGRADE","MAINTENANCE","DIAGNOSIS"]), issue:z.string().min(1), brand:z.string().optional(), model:z.string().optional(), imei:z.string().optional(), serialNumber:z.string().optional(), ram:z.string().optional(), storage:z.string().optional(), color:z.string().optional(), chargerReceived:z.boolean().optional(), bagReceived:z.boolean().optional(), condition:z.string().optional(), passwordNote:z.string().optional(), estimate:z.number().nonnegative().optional(), promisedDate:z.string().optional(), accessories:z.array(z.string()).optional(), inspection:z.array(z.object({item:z.string().min(1),status:z.enum(["YES","NO","N/A"]),note:z.string().optional()})).optional(), sendWhatsApp:z.boolean().optional() });

function buildReceivedReport(repair:any) { const customer=repair.customer?.name||"Customer"; const device=[repair.device?.brand,repair.device?.model].filter(Boolean).join(" ")||"Device"; return `Hello ${customer},\n\nAamee Cellcare\nJob Card: ${repair.ticketNumber}\nDevice: ${device}\nStatus: Device received\nComplaint: ${repair.issue}\nEstimated Cost: ₹${Number(repair.estimate||0).toLocaleString("en-IN")}\n\nWe will update you at each repair stage.\nThank you, Aamee Cellcare`; }

export async function GET(req:NextRequest){const u=await requireAuth(req);const branchFilter=u.role==="OWNER"?{isActive:true}:{isActive:true,assignments:{some:{userId:u.id}}};return NextResponse.json({repairs:await prisma.repairJob.findMany({where:{branch:branchFilter},include:{customer:true,branch:true,technician:true,device:true},orderBy:{createdAt:"desc"},take:500})});}

export async function POST(req:NextRequest){
  const u=await requireAuth(req); const parsed=Schema.safeParse(await req.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({message:"Invalid repair",issues:parsed.error.flatten()},{status:400}); const p=parsed.data; await requireBranchAccess(u.id,u.role,p.branchId);
  try {
    const count=await prisma.repairJob.count({where:{branchId:p.branchId}}); const ticket=`R-${String(count+1).padStart(5,"0")}`;
    const repair=await prisma.$transaction(async tx=>{
      const created=await tx.repairJob.create({data:{branchId:p.branchId,customerId:p.customerId||null,ticketNumber:ticket,deviceType:p.deviceType,serviceType:p.serviceType,issue:p.issue,estimate:p.estimate??0,approvedAmount:null,advanceAmount:0,balanceAmount:p.estimate??0,status:"RECEIVED",createdById:u.id,promisedDate:p.promisedDate?new Date(p.promisedDate):null,device:{create:{brand:p.brand||null,model:p.model||null,imei:p.imei||null,serialNumber:p.serialNumber||null,ram:p.ram||null,storage:p.storage||null,color:p.color||null,chargerReceived:!!p.chargerReceived,bagReceived:!!p.bagReceived,condition:p.condition||null,passwordNote:p.passwordNote||null}}}});
      await tx.repairStatusHistory.create({data:{repairJobId:created.id,newStatus:"RECEIVED",changedById:u.id,note:"Job card created"}});
      if(p.customerId) await tx.customerVisit.create({data:{customerId:p.customerId,branchId:p.branchId,type:"REPAIR",createdById:u.id}});
      if(p.accessories?.length) await tx.repairAccessory.createMany({data:p.accessories.map(name=>({repairJobId:created.id,name,quantity:1}))});
      if(p.inspection?.length) await tx.repairInspection.createMany({data:p.inspection.map(x=>({repairJobId:created.id,item:x.item,status:x.status,note:x.note}))});
      return created;
    });
    const full=await prisma.repairJob.findUnique({where:{id:repair.id},include:{customer:true,device:true,branch:true}});
    const whatsapp = full?.customer?.phone ? { clickToChatUrl: buildWhatsAppLink(full.customer.phone, buildReceivedReport(full)) } : { clickToChatUrl: "", reason: "Customer phone number is missing." };
    return NextResponse.json({repair,whatsapp},{status:201});
  } catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Unable to create repair"},{status:400});}
}
