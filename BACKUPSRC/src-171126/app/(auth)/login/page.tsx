import { Suspense } from "react";
import LoginForm from "./LoginForm";

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#102d4b] px-4">
      <div className="rounded-2xl bg-white p-7 shadow-2xl">
        <p className="text-sm text-slate-500">
          Loading...
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}