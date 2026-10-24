"use client";

import { FormEvent, useState } from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [identifier, setIdentifier] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] = useState<
    string | null
  >(
    params.get("expired")
      ? "Your session has expired. Please log in again."
      : null,
  );

  const [loading, setLoading] =
    useState(false);

  async function submit(
    e: FormEvent<HTMLFormElement>,
  ) {
    e.preventDefault();

    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            identifier,
            password,
          }),
        },
      );

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        setError(
          data?.message ??
            "Unable to sign in.",
        );

        setLoading(false);
        return;
      }

      const next = params.get("next");

      const redirectTo =
        next &&
        next.startsWith("/") &&
        !next.startsWith("//")
          ? next
          : "/dashboard";

      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      console.error(
        "Login error:",
        error,
      );

      setError(
        "Unable to connect to the server. Please try again.",
      );

      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#102d4b] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"
      >
        <div className="text-xs font-bold tracking-[0.25em] text-blue-700">
          AAMEE CELLCARE
        </div>

        <h1 className="mt-2 text-2xl font-extrabold">
          Sign in
        </h1>

        <p className="mt-1 text-sm text-slate-500">
          Owner and employee access
        </p>

        <label className="mt-6 block text-sm font-medium">
          Email or phone

          <input
            value={identifier}
            onChange={(e) =>
              setIdentifier(e.target.value)
            }
            required
            disabled={loading}
            className="mt-2 w-full rounded-lg border p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            autoComplete="username"
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Password

          <div className="relative mt-2">
            <input
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value,
                )
              }
              required
              disabled={loading}
              className="w-full rounded-lg border p-3 pr-11 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
              autoComplete="current-password"
            />

            <button
              type="button"
              onClick={() =>
                setShowPassword(
                  (value) => !value,
                )
              }
              disabled={loading}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              title={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>
        </label>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={
            loading ||
            !identifier.trim() ||
            !password
          }
          className="mt-6 w-full rounded-lg bg-blue-700 p-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? "Signing in..."
            : "Sign in"}
        </button>
      </form>
    </main>
  );
}