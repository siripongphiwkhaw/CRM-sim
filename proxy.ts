import { getIronSession } from "iron-session";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    sessionOptions
  );

  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!session.userId && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session.userId && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Admin-only areas: SQL console and admin settings.
  const adminOnly = pathname.startsWith("/sql") || pathname.startsWith("/admin");
  if (adminOnly && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
