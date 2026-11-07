import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { z } from "zod";

const Schema = z.object({ name: z.string().trim().min(2).max(80) });

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export async function GET() {
  await requireAuth();
  const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return NextResponse.json({ categories });
}

export async function POST(request: NextRequest) {
  await requireAuth(request);
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid category" }, { status: 400 });
  const slug = slugify(parsed.data.name);
  const category = await prisma.category.upsert({
    where: { slug },
    update: { name: parsed.data.name, isActive: true },
    create: { name: parsed.data.name, slug },
  });
  return NextResponse.json({ category }, { status: 201 });
}
