import { requireOwnerPage } from "@/lib/auth/page-guards";
export default async function Page(){await requireOwnerPage();return <div className="rounded-2xl bg-white p-8 ring-1 ring-slate-200"><h1 className="text-2xl font-bold">Settings</h1><p className="mt-2 text-slate-500">Business configuration will be implemented in the next phase.</p></div>}
