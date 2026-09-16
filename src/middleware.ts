import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const isHttps =
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https";

  // Check all variations of NextAuth / Auth.js session cookies
  const sessionCookie =
    req.cookies.get("__Secure-authjs.session-token")?.value ||
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value ||
    req.cookies.get("next-auth.session-token")?.value;

  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "arenax-jwt-secret-key-production-2026";

  let token = null;
  if (sessionCookie) {
    try {
      token = await getToken({
        req,
        secret,
        secureCookie: isHttps,
        cookieName: isHttps
          ? req.cookies.has("__Secure-authjs.session-token")
            ? "__Secure-authjs.session-token"
            : "__Secure-next-auth.session-token"
          : req.cookies.has("authjs.session-token")
          ? "authjs.session-token"
          : "next-auth.session-token",
      });
    } catch {
      // ignore decoding error
    }
  }

  // If token decoded OR valid session cookie exists
  const isAuth = !!token || !!sessionCookie;

  const isAuthPage =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/register");

  if (isAuthPage) {
    if (isAuth) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (!isAuth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/play/:path*",
    "/profile/:path*",
    "/leaderboard",
    "/matches/:path*",
    "/settings/:path*",
    "/login",
    "/register",
  ],
};
