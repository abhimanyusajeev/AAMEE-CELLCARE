import crypto from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const SESSION_COOKIE = "aamee_session";
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_TOUCH_INTERVAL_MS = 60 * 1000;

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function newToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 30,
  };
}

export async function createSession(userId: string, response: NextResponse) {
  const raw = newToken();
  const now = new Date();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + IDLE_TIMEOUT_MS),
    },
  });

  response.cookies.set(SESSION_COOKIE, raw, cookieOptions());
}

const resolveFromDatabase = cache(async (raw: string) => {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  if (!session || !session.user.isActive || session.revokedAt) return null;

  const now = Date.now();
  if (
    now - session.lastActivityAt.getTime() >= IDLE_TIMEOUT_MS ||
    session.expiresAt.getTime() <= now
  ) {
    await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  // Avoid a database write on every authenticated request. The client heartbeat
  // runs once per minute, and normal authenticated requests only touch the session
  // when the previous touch is older than the same interval. This keeps the
  // server-side idle timeout accurate without exhausting the Neon connection pool.
  if (now - session.lastActivityAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
    const touchedAt = new Date(now);
    await prisma.session.update({
      where: { id: session.id },
      data: {
        lastActivityAt: touchedAt,
        expiresAt: new Date(now + IDLE_TIMEOUT_MS),
      },
    });
  }

  return session;
});

// Authenticated pages often issue several parallel requests (branches, products,
// customers, heartbeat, etc.). A very short in-process cache prevents those
// requests from opening a separate Neon connection for the exact same session.
// The TTL is deliberately tiny so revocation/role changes remain near-real-time.
const SESSION_CACHE_TTL_MS = 2_000;
const sessionCache = new Map<string, { expiresAt: number; promise: ReturnType<typeof resolveFromDatabase> }>();

async function resolve(raw: string) {
  const key = hashToken(raw);
  const now = Date.now();
  const cached = sessionCache.get(key);
  if (cached && cached.expiresAt > now) return cached.promise;
  if (cached) sessionCache.delete(key);

  const promise = resolveFromDatabase(raw);
  if (sessionCache.size >= 1000) sessionCache.delete(sessionCache.keys().next().value as string);
  sessionCache.set(key, { expiresAt: now + SESSION_CACHE_TTL_MS, promise });
  promise.catch(() => {
    const current = sessionCache.get(key);
    if (current?.promise === promise) sessionCache.delete(key);
  });
  return promise;
}

export async function getCurrentSession(request?: NextRequest) {
  const raw =
    request?.cookies.get(SESSION_COOKIE)?.value ??
    (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  return resolve(raw);
}

export async function requireAuth(request?: NextRequest) {
  const session = await getCurrentSession(request);
  if (!session) throw new UnauthenticatedError();
  return session.user;
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  constructor(message = "Unauthenticated") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export async function requireOwner(request?: NextRequest) {
  const user = await requireAuth(request);
  if (user.role !== "OWNER") throw new ForbiddenError();
  return user;
}

export async function requireBranchAccess(
  userId: string,
  role: "OWNER" | "EMPLOYEE",
  branchId: string,
) {
  if (role === "OWNER") {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, isActive: true },
      select: { id: true },
    });
    if (!branch) throw new ForbiddenError();
    return;
  }

  const assignment = await prisma.userBranchAssignment.findFirst({
    where: {
      userId,
      branchId,
      branch: { isActive: true },
    },
    select: { id: true },
  });

  if (!assignment) throw new ForbiddenError();
}

export async function revokeCurrentSession(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const response = NextResponse.json({ ok: true });

  if (raw) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(raw), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  return response;
}
