
import { prisma } from "@/lib/db/prisma";
import { CategoryManager } from "@/components/management/CategoryManager";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: [
      { isActive: "desc" },
      { name: "asc" },
    ],
    include: {
      _count: {
        select: {
          products: true,
        },
      },
    },
  });

  return (
    <CategoryManager
      initialCategories={categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        isActive: category.isActive,
        productCount: category._count.products,
      }))}
    />
  );
}
