import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireBranchAccess } from "@/lib/auth/session";
import { buildWhatsAppLink, normalizeWhatsAppPhone } from "@/lib/whatsapp";

const S=z.object({branchId:z.string(),customerId:z.string().optional(),toPhone:z.string().min(7),messageType:z.string().min(1),body:z.string().max(4000).optional(),mediaUrl:z.string().url().optional()});
export async function GET(req:NextRequest){const u=await requireAuth(req);return NextResponse.json({messages:await prisma.whatsAppMessage.findMany({where:{branch:u.role==="OWNER"?{isActive:true}:{isActive:true,assignments:{some:{userId:u.id}}}},include:{customer:true,branch:true},orderBy:{createdAt:"desc"},take:200})});}
export async function POST(req:NextRequest){const u=await requireAuth(req);const p=S.safeParse(await req.json().catch(()=>null));if(!p.success)return NextResponse.json({message:"Invalid WhatsApp message",issues:p.error.flatten()},{status:400});await requireBranchAccess(u.id,u.role,p.data.branchId);const body=p.data.body||"";const phone=normalizeWhatsAppPhone(p.data.toPhone);const m=await prisma.whatsAppMessage.create({data:{branchId:p.data.branchId,customerId:p.data.customerId||null,sentById:u.id,toPhone:phone,messageType:p.data.messageType,body,mediaUrl:p.data.mediaUrl||null,status:"QUEUED"}});return NextResponse.json({message:m,clickToChatUrl:buildWhatsAppLink(p.data.toPhone,body)});}
