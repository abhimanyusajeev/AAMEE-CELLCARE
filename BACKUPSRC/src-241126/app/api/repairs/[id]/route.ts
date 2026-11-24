import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requireBranchAccess } from "@/lib/auth/session";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const statuses = ["RECEIVED", "DIAGNOSIS", "WAITING_FOR_CUSTOMER_APPROVAL", "WAITING_FOR_PARTS", "REPAIRING", "READY_FOR_PICKUP", "DELIVERED", "CANCELLED"] as const;
const Schema = z.object({
  status: z.enum(statuses).optional(),
  diagnosis: z.string().max(2000).optional(),
  approvedAmount: z.number().nonnegative().optional(),
  estimate: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  advanceAmount: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
  addNote: z.string().trim().min(1).max(2000).optional(),
  technicianId: z.string().nullable().optional(),
  inspection: z.object({ item: z.string().min(1).max(100), status: z.enum(["YES", "NO", "N/A"]), note: z.string().max(500).optional() }).optional(),
  addAccessory: z.object({ name: z.string().min(1).max(100), quantity: z.number().int().positive().default(1), condition: z.string().max(100).optional() }).optional(),
  addPart: z.object({ productVariantId: z.string(), quantity: z.number().int().positive() }).optional(),
  sendWhatsApp: z.boolean().optional(),
  createInvoice: z.boolean().optional(),
});

const statusText: Record<string, string> = {
  RECEIVED: "Device received",
  DIAGNOSIS: "Device inspection / diagnosis started",
  WAITING_FOR_CUSTOMER_APPROVAL: "Repair estimate is awaiting your approval",
  WAITING_FOR_PARTS: "Repair is waiting for spare parts",
  REPAIRING: "Repair is in progress",
  READY_FOR_PICKUP: "Repair completed and ready for pickup",
  DELIVERED: "Device delivered successfully",
  CANCELLED: "Repair job cancelled",
};

function buildReport(repair: any) {
  const customer = repair.customer?.name || "Customer";
  const device = [repair.device?.brand, repair.device?.model].filter(Boolean).join(" ") || "your device";
  const stage = statusText[repair.status] || repair.status;
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  const trackingUrl = baseUrl ? `${baseUrl}/track?id=${encodeURIComponent(repair.id)}` : "";
  const trackingLine = trackingUrl ? `\n\n\u{1F50E} Track your repair:\n${trackingUrl}` : "";
  return `Hi ${customer} \u{1F44B}\n\nYour AAMEE CELLCARE repair update \u{1F4F2}\n\n\u{1F4CB} Job Card: ${repair.ticketNumber}\n\u{1F4F1} Device: ${device}\n\u{1F4C5} Status: ${stage}\n\u{1F4B0} Estimated Cost: ₹${Number(repair.estimate || 0).toLocaleString("en-IN")}\n\u{1F4B5} Balance Due: ₹${Number(repair.balanceAmount || 0).toLocaleString("en-IN")}\n\nThank you for choosing us!${trackingLine}\n\n— AAMEE CELLCARE\n\u{1F4DE} 9207277210\n\u{1F4DE} 9207277770`;
}



export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireAuth(req);
  const { id } = await params;
  const repair = await prisma.repairJob.findUnique({
    where: { id },
    include: { branch: true, customer: true, technician: true, device: true, parts: { include: { productVariant: { include: { product: true } } } }, inspections: true, accessories: true, statusHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { changedAt: "asc" } }, payments: true, invoice: true },
  });
  if (!repair) return NextResponse.json({ message: "Repair not found" }, { status: 404 });
  await requireBranchAccess(u.id, u.role, repair.branchId);
  return NextResponse.json({ repair });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const u = await requireAuth(req);
  const { id } = await params;
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid repair update", issues: parsed.error.flatten() }, { status: 400 });
  const p = parsed.data;
  const existing = await prisma.repairJob.findUnique({ where: { id }, include: { customer: true, device: true } });
  if (!existing) return NextResponse.json({ message: "Repair not found" }, { status: 404 });
  await requireBranchAccess(u.id, u.role, existing.branchId);
  const proposedFinal = Number(p.approvedAmount ?? p.estimate ?? existing.approvedAmount ?? existing.estimate ?? 0);
  const proposedDiscount = Number(p.discountAmount ?? (existing as any).discountAmount ?? 0);
  const proposedAdvance = Number(p.advanceAmount ?? existing.advanceAmount);
  if (proposedDiscount > proposedFinal) return NextResponse.json({message:"Discount cannot exceed the final amount."},{status:400});
  if (proposedAdvance > proposedFinal - proposedDiscount) return NextResponse.json({message:"Advance cannot exceed the discounted final amount."},{status:400});

  try {
    await prisma.$transaction(async (tx) => {
      const data: any = {};
      for (const key of ["diagnosis", "approvedAmount", "estimate", "discountAmount", "technicianId"] as const) if (key in p) data[key] = p[key];
      if (p.notes !== undefined) data.notes = p.notes;
      if (p.addNote) {
        const stamp = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
        const entry = `[${stamp}] ${p.addNote}`;
        data.notes = existing.notes ? `${existing.notes}\n\n${entry}` : entry;
      }
      if (p.status) data.status = p.status;
      if (p.status === "DELIVERED" && existing.status !== "DELIVERED") data.deliveredAt = new Date();
      if (p.status === "READY_FOR_PICKUP") data.completedAt = new Date();
      const finalAmount = p.approvedAmount ?? p.estimate ?? Number(existing.approvedAmount ?? existing.estimate ?? 0);
      const discountAmount = p.discountAmount ?? Number((existing as any).discountAmount ?? 0);
      const advanceAmount = p.advanceAmount ?? Number(existing.advanceAmount);
      if (p.advanceAmount !== undefined && p.advanceAmount > Number(existing.advanceAmount)) {
        const extraAdvance = p.advanceAmount - Number(existing.advanceAmount);
        await tx.repairPayment.create({ data: { branchId: existing.branchId, repairJobId: id, amount: extraAdvance, paymentType: "ADVANCE" } });
        data.advanceAmount = p.advanceAmount;
      }
      if (p.approvedAmount !== undefined || p.estimate !== undefined || p.discountAmount !== undefined || p.advanceAmount !== undefined) {
        data.balanceAmount = Math.max(0, finalAmount - discountAmount - advanceAmount);
      }
      if (Object.keys(data).length) await tx.repairJob.update({ where: { id }, data });

      const updateEvents: string[] = [];
      if (p.addNote) updateEvents.push(`Repair note: ${p.addNote}`);
      if (p.diagnosis !== undefined) updateEvents.push("Updated: diagnosis / technician remarks");
      if (p.approvedAmount !== undefined || p.estimate !== undefined) updateEvents.push("Updated: approved repair amount");
      if (p.discountAmount !== undefined) updateEvents.push("Updated: discount amount");
      if (p.advanceAmount !== undefined) updateEvents.push("Updated: advance payment");
      if (p.technicianId !== undefined) updateEvents.push("Updated: assigned technician");
      if (p.inspection) updateEvents.push(`Updated: inspection — ${p.inspection.item} (${p.inspection.status})`);
      if (p.addAccessory) updateEvents.push(`Updated: accessory added — ${p.addAccessory.name} × ${p.addAccessory.quantity}`);
      if (p.addPart) updateEvents.push(`Updated: spare part used — ${p.addPart.quantity} unit(s)`);
      if (p.status && p.status !== existing.status) {
        await tx.repairStatusHistory.create({ data: { repairJobId: id, oldStatus: existing.status, newStatus: p.status, changedById: u.id, note: updateEvents.join("\n") || undefined } });
      } else if (updateEvents.length) {
        await tx.repairStatusHistory.create({ data: { repairJobId: id, oldStatus: existing.status, newStatus: existing.status, changedById: u.id, note: updateEvents.join("\n") } });
      }
      if (p.status === "DELIVERED" && existing.status !== "DELIVERED") {
        const finalAmount = Number(p.approvedAmount ?? p.estimate ?? existing.approvedAmount ?? existing.estimate ?? 0);
        const discount = Number(p.discountAmount ?? (existing as any).discountAmount ?? 0);
        const netTotal = Math.max(0, finalAmount - discount);
        const priorInvoice = await tx.repairInvoice.findUnique({ where: { repairJobId: id } });
        if (!priorInvoice) {
          const invoiceCount = await tx.repairInvoice.count({ where: { branchId: existing.branchId } });
          await tx.repairInvoice.create({ data: { branchId: existing.branchId, repairJobId: id, invoiceNumber: `SR-${String(invoiceCount + 1).padStart(5, "0")}`, subtotal: finalAmount, discount, total: netTotal, status: "ISSUED" } });
        } else {
          await tx.repairInvoice.update({ where: { repairJobId: id }, data: { subtotal: finalAmount, discount, total: netTotal, status: "ISSUED" } });
        }
        const priorTransaction = await tx.transaction.findFirst({ where: { branchId: existing.branchId, type: "REPAIR", referenceId: id } });
        if (!priorTransaction) await tx.transaction.create({ data: { branchId: existing.branchId, type: "REPAIR", referenceId: id, referenceNo: existing.ticketNumber, amount: netTotal, note: `Repair ${existing.serviceType} revenue` } });
      }
      if (p.inspection) await tx.repairInspection.upsert({ where: { repairJobId_item: { repairJobId: id, item: p.inspection.item } }, update: { status: p.inspection.status, note: p.inspection.note }, create: { repairJobId: id, item: p.inspection.item, status: p.inspection.status, note: p.inspection.note } });
      if (p.addAccessory) await tx.repairAccessory.create({ data: { repairJobId: id, name: p.addAccessory.name, quantity: p.addAccessory.quantity, condition: p.addAccessory.condition } });
      if (p.createInvoice) {
        const existingInvoice = await tx.repairInvoice.findUnique({ where: { repairJobId: id } });
        if (!existingInvoice) {
          const invoiceCount = await tx.repairInvoice.count({ where: { branchId: existing.branchId } });
          const invoiceNumber = `SR-${String(invoiceCount + 1).padStart(5, "0")}`;
          const subtotal = Number(existing.approvedAmount ?? existing.estimate ?? 0) || 0;
          await tx.repairInvoice.create({ data: { branchId: existing.branchId, repairJobId: id, invoiceNumber, subtotal, total: subtotal, status: "ISSUED" } });
        }
      }
      if (p.addPart) {
        const variant = await tx.productVariant.findUnique({ where: { id: p.addPart.productVariantId }, include: { product: true } });
        if (!variant || variant.product.productType !== "SPARE_PART") throw new Error("Selected item is not a spare part.");
        const deducted = await tx.inventoryItem.updateMany({
          where: { productVariantId: p.addPart.productVariantId, branchId: existing.branchId, quantity: { gte: p.addPart.quantity } },
          data: { quantity: { decrement: p.addPart.quantity } },
        });
        if (deducted.count !== 1) throw new Error("Insufficient spare-part stock for this branch.");
        await tx.repairPart.create({ data: { repairJobId: id, productVariantId: p.addPart.productVariantId, quantity: p.addPart.quantity, unitPrice: variant.sellingPrice } });
        await tx.stockMovement.create({ data: { branchId: existing.branchId, productVariantId: p.addPart.productVariantId, quantity: -p.addPart.quantity, type: "REPAIR_USAGE", referenceType: "REPAIR_JOB", referenceId: id, note: `Used in repair ${existing.ticketNumber}`, createdById: u.id } });
      }
    });

    const repair = await prisma.repairJob.findUnique({ where: { id }, include: { customer: true, branch: true, technician: true, device: true, parts: { include: { productVariant: { include: { product: true } } } }, inspections: true, accessories: true, statusHistory: { include: { changedBy: { select: { name: true } } }, orderBy: { changedAt: "asc" } }, invoice: true } });
    if (!repair) return NextResponse.json({ message: "Repair not found after update" }, { status: 404 });

    const whatsapp = repair.customer?.phone ? { clickToChatUrl: buildWhatsAppLink(repair.customer.phone, buildReport(repair)) } : { clickToChatUrl: "", reason: "Customer phone number is missing." };
    await prisma.auditLog.create({ data: { branchId: existing.branchId, actorId: u.id, action: "UPDATE", entityType: "REPAIR_JOB", entityId: id, metadata: { status: p.status, inspection: p.inspection?.item, accessory: p.addAccessory?.name, part: p.addPart?.productVariantId, whatsapp: Boolean(whatsapp?.clickToChatUrl) } } });
    return NextResponse.json({ repair, whatsapp });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to update repair" }, { status: 400 });
  }
}
