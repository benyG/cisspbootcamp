import { NextResponse, type NextRequest } from "next/server";

import { labLinkFor } from "@/lib/replays-server";

export const dynamic = "force-dynamic";

/** A participant downloads a lab: checked, then served by private storage through a ten-minute link. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string; day: string }> }) {
  const { token, day } = await params;
  const url = await labLinkFor(token, Number(day) || 0);
  if (!url) return new NextResponse("Ce lab n'est pas disponible avec ce lien (accès terminé ou non publié).", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
