import { NextRequest, NextResponse } from "next/server";
const protectedPrefixes = ["/dashboard","/sales","/bills","/inventory","/products","/customers","/repairs","/purchases","/suppliers","/expenses","/transactions","/reports","/users","/branches","/settings"];
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const protectedPath = protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!protectedPath) return NextResponse.next();
  if (!request.cookies.get("aamee_session")?.value) {
    const url = request.nextUrl.clone(); url.pathname = "/login"; url.searchParams.set("next", path); return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/dashboard/:path*","/sales/:path*","/bills/:path*","/inventory/:path*","/products/:path*","/customers/:path*","/repairs/:path*","/purchases/:path*","/suppliers/:path*","/expenses/:path*","/transactions/:path*","/reports/:path*","/users/:path*","/branches/:path*","/settings/:path*"] };

