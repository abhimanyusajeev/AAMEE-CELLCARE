import { requireAuth } from "@/lib/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { SessionTimeoutGuard } from "@/components/auth/SessionTimeoutGuard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  return <div className="min-h-screen bg-[#f5f7fb]"><Sidebar role={user.role} /><div className="min-w-0 lg:pl-64"><Topbar userName={user.name} role={user.role} /><SessionTimeoutGuard /><main className="app-main min-w-0 overflow-x-clip px-3 pb-28 pt-4 sm:px-5 sm:pb-8 sm:pt-5 lg:px-7 lg:pt-6">{children}</main></div></div>;
}
