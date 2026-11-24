import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, requireAuth, requireOwner } from "@/lib/auth/session";

const BranchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().min(2).max(10).regex(/^[A-Z0-9-]+$/),
  address: z.string().trim().min(2).max(300),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email().max(160).optional().or(z.literal("")),
  invoicePrefix: z.string().trim().toUpperCase().min(2).max(20).regex(/^[A-Z0-9-]+$/),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  const branches = user.role === "OWNER"
    ? await prisma.branch.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] })
    : await prisma.branch.findMany({
        where: { isActive: true, assignments: { some: { userId: user.id } } },
        orderBy: { name: "asc" },
      });

  return NextResponse.json({ branches });
}

export async function POST(request: NextRequest) {
  try { await requireOwner(request); } catch (error) { if (error instanceof ForbiddenError) return NextResponse.json({ message: "Forbidden" }, { status: 403 }); throw error; }
  const parsed = BranchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid branch details." }, { status: 400 });

  try {
    const branch = await prisma.branch.create({
      data: {
        name: parsed.data.name,
        code: parsed.data.code,
        address: parsed.data.address,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        invoicePrefix: parsed.data.invoicePrefix,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return NextResponse.json({ branch }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ message: "Branch code already exists." }, { status: 409 });
    }
    return NextResponse.json({ message: "Unable to create branch." }, { status: 500 });
  }
}
