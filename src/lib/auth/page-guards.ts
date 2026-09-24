import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/session";

export async function requireOwnerPage() {
  const user = await requireAuth();
  if (user.role !== "OWNER") redirect("/forbidden");
  return user;
}
