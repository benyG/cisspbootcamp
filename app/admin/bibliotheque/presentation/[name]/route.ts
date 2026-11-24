import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { readLibraryDeck } from "@/lib/library";

export const dynamic = "force-dynamic";

const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Ben downloads a trainer's presentation kept with the library (content/library/files). Admin only. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return new NextResponse("Non autorisé", { status: 401 });
  const { name } = await params;
  const deck = readLibraryDeck(name);
  if (!deck) return new NextResponse("Présentation introuvable.", { status: 404 });
  return new NextResponse(new Uint8Array(deck), {
    headers: { "Content-Type": PPTX, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
