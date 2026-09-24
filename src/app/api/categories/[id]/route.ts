import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
const Schema = z.object({ name: z.string().trim().min(2).max(80), isActive: z.boolean().optional() });
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  await requireAuth(request); const { id } = await context.params; const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid category." }, { status: 400 });
  const slug = parsed.data.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  try { const category = await prisma.category.update({ where: { id }, data: { name: parsed.data.name, slug, ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {}) } }); return NextResponse.json({ category }); }
  catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Unable to update category." }, { status: 400 }); }
}
