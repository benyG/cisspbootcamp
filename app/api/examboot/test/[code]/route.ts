import { NextResponse } from "next/server";

import { examBootEnabled } from "@/lib/examboot/client";
import { syncResult } from "@/lib/examboot/service";

export const dynamic = "force-dynamic";

/** Relays the score of one test; the page polls this every 10 s, 30 min at most. */
export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  if (!examBootEnabled()) return NextResponse.json({ error: "disabled" }, { status: 404 });
  const { code } = await context.params;
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(code)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const result = await syncResult(code);
    if (!result) return NextResponse.json({ error: "unknown" }, { status: 404 });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[examboot] lecture impossible", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "read_failed" }, { status: 502 });
  }
}
