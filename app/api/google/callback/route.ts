import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { STATE_COOKIE, exchangeCode, saveCredential } from "@/lib/calendar/google";
import { safeEquals } from "@/lib/tokens";

/**
 * Return leg of the calendar consent. Only the signed-in admin may complete
 * it, and the `state` must match the cookie set when the flow started.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/admin/connexion", request.nextUrl.origin));
  }

  const params = request.nextUrl.searchParams;
  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value ?? "";
  const received = params.get("state") ?? "";
  jar.delete(STATE_COOKIE);

  const back = (query: string) =>
    NextResponse.redirect(new URL(`/admin/parametres/google?${query}`, request.nextUrl.origin));

  if (!expected || !safeEquals(expected, received)) return back("erreur=state");
  if (params.get("error")) return back(`erreur=${encodeURIComponent(params.get("error") ?? "")}`);

  const code = params.get("code");
  if (!code) return back("erreur=code");

  try {
    const credential = await exchangeCode(code);
    await saveCredential(credential);
    return back("ok=1");
  } catch (error) {
    const message = error instanceof Error ? error.message : "inconnue";
    return back(`erreur=${encodeURIComponent(message)}`);
  }
}
