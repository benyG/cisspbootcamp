import { NextResponse } from "next/server";

import { auth } from "@/auth";

/**
 * Guards the whole admin area. Everything else is public: prospects are
 * identified by signed tokens, not by an account (SPECS A2, A3).
 */
export default auth((request) => {
  const isSignInPage = request.nextUrl.pathname === "/admin/connexion";

  if (!request.auth && !isSignInPage) {
    const signInUrl = new URL("/admin/connexion", request.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (request.auth && isSignInPage) {
    return NextResponse.redirect(new URL("/admin", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
