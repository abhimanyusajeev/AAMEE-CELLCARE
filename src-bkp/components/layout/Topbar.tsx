"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Branch = { id: string; name: string };

export function Topbar({
  userName,
  role,
}: {
  userName: string;
  role: "OWNER" | "EMPLOYEE";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [branchId, setBranchId] = useState("ALL");
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    let active = true;
    const cacheKey = `aamee_branches_${role}`;
    const cachedRaw = sessionStorage.getItem(cacheKey);
    let cached: { at: number; branches: Branch[] } | null = null;

    try {
      cached = cachedRaw ? JSON.parse(cachedRaw) : null;
    } catch {
      cached = null;
    }

    const applyBranches = (nextBranches: Branch[]) => {
      if (!active) return;
      setBranches(nextBranches);
      const stored = localStorage.getItem("aamee_selected_branch");

      if (role === "OWNER") {
        const selected =
          stored &&
          (stored === "ALL" || nextBranches.some((branch) => branch.id === stored))
            ? stored
            : "ALL";
        setBranchId(selected);
        document.cookie = `aamee_selected_branch=${encodeURIComponent(selected)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
      } else {
        const assigned = nextBranches[0]?.id ?? "";
        setBranchId(assigned);
        if (assigned) {
          localStorage.setItem("aamee_selected_branch", assigned);
          document.cookie = `aamee_selected_branch=${encodeURIComponent(assigned)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
        }
      }
    };

    if (cached?.branches?.length && Date.now() - cached.at < 5 * 60 * 1000) {
      applyBranches(cached.branches);
      return () => {
        active = false;
      };
    }

    fetch("/api/branches", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const nextBranches: Branch[] = data?.branches ?? [];
        if (nextBranches.length) {
          sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), branches: nextBranches }));
        }
        applyBranches(nextBranches);
      })
      .catch(() => {
        if (cached?.branches?.length) applyBranches(cached.branches);
      });

    return () => {
      active = false;
    };
  }, [role]);

  function persistBranch(value: string) {
    setBranchId(value);
    localStorage.setItem("aamee_selected_branch", value);
    document.cookie = `aamee_selected_branch=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    window.dispatchEvent(new CustomEvent("aamee-branch-change", { detail: value }));

    if (pathname === "/dashboard") {
      router.refresh();
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
      <div>
        <div className="text-sm font-semibold text-slate-900">Welcome back!</div>
        <div className="text-xs text-slate-500">Manage your inventory, sales and services at Aamee Cellcare.</div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={role === "OWNER" ? branchId : branches[0]?.id ?? ""}
          disabled={role !== "OWNER" || !branches.length}
          onChange={(e) => persistBranch(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          aria-label="Select shop"
        >
          {role === "OWNER" && <option value="ALL">All Shops</option>}
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>

        <div className="hidden text-right sm:block">
          <div className="text-sm font-semibold text-slate-800">{userName}</div>
          <div className="text-xs text-slate-500">{role}</div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
