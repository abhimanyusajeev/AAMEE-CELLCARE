import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl font-bold text-red-600">!</div>
        <h1 className="text-2xl font-bold text-slate-900">Access denied</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">You don&apos;t have permission to access this page. Please contact your administrator if you believe this is incorrect.</p>
        <Link href="/dashboard" className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white">Back to Dashboard</Link>
      </div>
    </main>
  );
}
