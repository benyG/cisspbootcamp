import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { MAX_MESSAGE_CHARS } from "@/lib/assistant";
import { askAssistant } from "@/lib/assistant-server";

export const dynamic = "force-dynamic";

const body = z.object({
  conversationId: z.string().regex(/^[a-f0-9]{24}$/).nullable().default(null),
  message: z.string().trim().min(1).max(MAX_MESSAGE_CHARS),
  program: z.enum(["cissp", "ia"]).default("cissp"),
});

/** One visitor message to the site assistant (lot C). */
export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Message invalide." }, { status: 400 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnu";
  const reply = await askAssistant({ ...parsed.data, ip });
  return NextResponse.json(reply, { headers: { "Cache-Control": "no-store" } });
}
