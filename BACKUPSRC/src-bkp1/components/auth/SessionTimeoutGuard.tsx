"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const WARNING_MS = 28 * 60 * 1000;
const LOGOUT_MS = 30 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;

export function SessionTimeoutGuard() {
  const router = useRouter();
  const lastInteraction = useRef(Date.now());
  const lastHeartbeat = useRef(0);
  const heartbeatRetryAfter = useRef(0);
  const heartbeatInFlight = useRef(false);
  const [warning, setWarning] = useState(false);

  useEffect(() => {
    let mounted = true;

    const heartbeat = async () => {
      if (
        !mounted ||
        heartbeatInFlight.current ||
        Date.now() < heartbeatRetryAfter.current
      ) {
        return false;
      }
      heartbeatInFlight.current = true;
      try {
        const response = await fetch("/api/auth/heartbeat", {
          method: "POST",
          cache: "no-store",
        });
        if (response.status === 401) {
          router.replace("/login?expired=1");
          return false;
        }

        if (!response.ok) {
          // Do not log the user out because of a temporary database/network
          // failure. Retry after a short cooldown instead of flooding the API
          // from mouse/scroll events while the database is unavailable.
          heartbeatRetryAfter.current = Date.now() + 10_000;
          return false;
        }

        lastHeartbeat.current = Date.now();
        heartbeatRetryAfter.current = 0;
        return true;
      } catch {
        heartbeatRetryAfter.current = Date.now() + 10_000;
        return false;
      } finally {
        heartbeatInFlight.current = false;
      }
    };

    const touch = () => {
      lastInteraction.current = Date.now();
      setWarning(false);

      // Avoid a request for every mouse/scroll event while still keeping
      // the server-side idle timer aligned with real user activity.
      if (Date.now() - lastHeartbeat.current >= HEARTBEAT_MS) {
        void heartbeat();
      }
    };

    const events = ["pointerdown", "keydown", "mousemove", "touchstart", "scroll"];
    events.forEach((event) =>
      window.addEventListener(event, touch, { passive: true }),
    );

    const timer = window.setInterval(async () => {
      const idle = Date.now() - lastInteraction.current;

      if (idle >= LOGOUT_MS) {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
        router.replace("/login?expired=1");
        return;
      }

      setWarning(idle >= WARNING_MS);

      if (idle < WARNING_MS && Date.now() - lastHeartbeat.current >= HEARTBEAT_MS) {
        await heartbeat();
      }
    }, 5000);

    void heartbeat();

    return () => {
      mounted = false;
      window.clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, touch));
    };
  }, [router]);

  if (!warning) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-amber-200 bg-white p-4 shadow-2xl">
      <div className="font-semibold">Session expiring soon</div>
      <div className="mt-1 text-sm text-slate-600">
        You will be signed out after 30 minutes of inactivity.
      </div>
      <button
        type="button"
        onClick={() => {
          lastInteraction.current = Date.now();
          void heartbeatNow();
          setWarning(false);
        }}
        className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white"
      >
        Continue Session
      </button>
    </div>
  );
}

async function heartbeatNow() {
  await fetch("/api/auth/heartbeat", { method: "POST", cache: "no-store" }).catch(() => undefined);
}
