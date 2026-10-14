import { NextResponse, type NextRequest } from "next/server";

import { handleWebhook } from "@/lib/evaluations-server";

export const dynamic = "force-dynamic";

/** ExamBoot → us when a participant finishes an evaluation; signed with EXAMBOOT_WEBHOOK_SECRET. */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const { status, body } = await handleWebhook(raw, request.headers.get("x-webhook-signature"));
  return NextResponse.json(body, { status });
}
