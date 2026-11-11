import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, requireOwner } from "@/lib/auth/session";

const UpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  address: z.string().trim().min(2).max(300).optional(),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  invoicePrefix: z.string().trim().toUpperCase().min(2).max(20).regex(/^[A-Z0-9-]+$/).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try { await requireOwner(request); } catch (error) { if (error instanceof ForbiddenError) return NextResponse.json({ message: "Forbidden" }, { status: 403 }); throw error; }
  const { id } = await context.params;
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid branch details." }, { status: 400 });

  const existing = await prisma.branch.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ message: "Branch not found." }, { status: 404 });

  const branch = await prisma.branch.update({
    where: { id },
    data: {
      ...parsed.data,
      phone: parsed.data.phone === "" ? null : parsed.data.phone,
      email: parsed.data.email === "" ? null : parsed.data.email,
    },
  });

  return NextResponse.json({ branch });
}
