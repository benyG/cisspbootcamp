import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { LINKEDIN_STATE_COOKIE, connectLinkedin } from "@/lib/linkedin";
import { safeEquals } from "@/lib/tokens";

/** Return leg of the LinkedIn consent: the signed-in admin only, state checked. */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(new URL("/admin/connexion", request.nextUrl.origin));

  const params = request.nextUrl.searchParams;
  const jar = await cookies();
  const expected = jar.get(LINKEDIN_STATE_COOKIE)?.value ?? "";
  jar.delete(LINKEDIN_STATE_COOKIE);
  const back = (query: string) => NextResponse.redirect(new URL(`/admin/parametres/linkedin?${query}`, request.nextUrl.origin));

  if (!expected || !safeEquals(expected, params.get("state") ?? "")) return back("erreur=state");
  if (params.get("error")) return back(`erreur=${encodeURIComponent(params.get("error_description") ?? params.get("error") ?? "")}`);
  const code = params.get("code");
  if (!code) return back("erreur=code");
  try {
    await connectLinkedin(code);
    return back("ok=1");
  } catch (error) {
    return back(`erreur=${encodeURIComponent(error instanceof Error ? error.message : "inconnue")}`);
  }
}
