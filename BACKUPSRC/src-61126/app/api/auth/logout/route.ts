import { NextRequest } from "next/server"; import { revokeCurrentSession } from "@/lib/auth/session"; export async function POST(req:NextRequest){return revokeCurrentSession(req)}

