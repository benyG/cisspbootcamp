import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";
import { iaDomain, iaRoute } from "@/lib/ia-domain";

/**
 * Guards the whole admin area. Everything else is public: prospects are
 * identified by signed tokens, not by an account (SPECS A2, A3).
 */
const adminGuard = auth((request) => {
  const isSignInPage = request.nextUrl.pathname === "/admin/connexion";

  if (!request.auth && !isSignInPage) {
    const signInUrl = new URL("/admin/connexion", request.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(signInUrl);
  }

  if (request.auth && isSignInPage) {
    return NextResponse.redirect(new URL("/admin", request.nextUrl.origin));
  }

  return NextResponse.next();
});

/** Bâtisseur IA on its own domain (lib/ia-domain.ts), then the admin guard. */
export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  const route = iaRoute(
    { host: request.headers.get("host") ?? request.nextUrl.host, pathname: request.nextUrl.pathname, search: request.nextUrl.search },
    { iaDomain: iaDomain(), appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://www.cisspbootcamp.online" },
  );
  if (route.kind === "redirect") return NextResponse.redirect(route.url, 308);
  if (route.kind === "rewrite") {
    const url = request.nextUrl.clone();
    url.pathname = route.path;
    return NextResponse.rewrite(url);
  }
  if (request.nextUrl.pathname.startsWith("/admin")) return adminGuard(request as never, event as never);
  return NextResponse.next();
}

export const config = {
  // Everything but Next's static files: the IA domain needs to see every page request.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
