import { requireAuth } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { SessionTimeoutGuard } from "@/components/auth/SessionTimeoutGuard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  return <div className="min-h-screen bg-[#f5f7fb]"><Sidebar role={user.role} /><div className="min-w-0 lg:pl-64"><Topbar userName={user.name} role={user.role} /><SessionTimeoutGuard /><main className="min-w-0 overflow-x-hidden p-3 sm:p-4 md:p-6">{children}</main></div></div>;
}
