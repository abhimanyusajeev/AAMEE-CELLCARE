import { requireAuth } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { SessionTimeoutGuard } from "@/components/auth/SessionTimeoutGuard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <div className="flex min-h-screen bg-[#f5f7fb]">
      <Sidebar role={user.role} />
      <div className="min-w-0 flex-1">
        <Topbar userName={user.name} role={user.role} />
        <SessionTimeoutGuard />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
