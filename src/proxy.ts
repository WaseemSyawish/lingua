import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Routes that require authentication
const PROTECTED_ROUTES = ["/dashboard", "/practice", "/progress", "/history", "/onboarding"];

// Routes only for unauthenticated users
const AUTH_ROUTES = ["/auth/signin", "/auth/signup"];

export default async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // Redirect authenticated users away from auth pages
  if (token && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Redirect unauthenticated users to sign in
  if (!token && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Redirect authenticated users who haven't completed placement to onboarding
  if (
    token &&
    !token.placementCompleted &&
    pathname !== "/onboarding" &&
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route)) &&
    pathname !== "/onboarding"
  ) {
    // Only redirect to onboarding from protected routes (not from API routes)
    if (!pathname.startsWith("/api")) {
      return NextResponse.redirect(new URL("/onboarding", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/practice/:path*",
    "/progress/:path*",
    "/history/:path*",
    "/onboarding/:path*",
    "/auth/:path*",
  ],
};
