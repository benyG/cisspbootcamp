import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { handOverQuestion } from "@/lib/assistant-server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const body = z.object({
  conversationId: z.string().regex(/^[a-f0-9]{24}$/).nullable().default(null),
  email: z.string().trim().toLowerCase().email().max(180),
  question: z.string().trim().min(3).max(2000),
  /** The box the visitor ticked: never pre-ticked. */
  consent: z.literal(true),
  /** Honeypot: people never fill it. */
  website: z.string().max(0).optional(),
});

/** A question handed over to Ben, with consent to be answered by e-mail (lot C). */
export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Vérifiez l’e-mail, la question et la case de consentement." }, { status: 400 });
  const since = new Date(Date.now() - 86_400_000);
  if ((await prisma.siteQuestion.count({ where: { email: parsed.data.email, createdAt: { gte: since } } })) >= 3) {
    return NextResponse.json({ ok: false, error: "Vos questions sont bien arrivées : l’équipe vous répond par e-mail." }, { status: 429 });
  }
  await handOverQuestion(parsed.data);
  return NextResponse.json({ ok: true });
}
