import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const session = await getCurrentSession(request);
    if (!session) {
      return NextResponse.json({ message: "Session expired." }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    // A temporary database/network failure must not be treated as an expired
    // session. Returning 503 lets the client retry without forcing a logout.
    const code =
      error && typeof error === "object" && "code" in error
        ? (error as { code?: string }).code
        : undefined;

    if (code === "P1001" || code === "P2024" || code === "P1008") {
      return NextResponse.json(
        { message: "Database temporarily unavailable. Please retry." },
        { status: 503 },
      );
    }

    throw error;
  }
}
