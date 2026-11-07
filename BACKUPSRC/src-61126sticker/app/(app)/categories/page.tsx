import { prisma } from "@/lib/db/prisma";
import { requireAuth } from "@/lib/auth/session";
import { CategoryManager } from "@/components/management/CategoryManager";

export default async function CategoriesPage() {
  await requireAuth();
  const categories = await prisma.category.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], include: { _count: { select: { products: true } } } });
  return <CategoryManager initialCategories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug, isActive: c.isActive, productCount: c._count.products }))} />;
}
