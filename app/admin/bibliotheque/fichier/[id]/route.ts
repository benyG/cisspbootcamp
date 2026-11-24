import { issueSignedToken, presignUrl } from "@vercel/blob";
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Ben downloads a file of the library (slides, trainer files, preparation documents). Admin only. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return new NextResponse("Non autorisé", { status: 401 });
  const { id } = await params;
  const document = await prisma.document.findUnique({ where: { id: Number(id) || 0 }, select: { filename: true, mimeType: true, blobPathname: true, content: true } });
  if (!document) return new NextResponse("Fichier introuvable.", { status: 404 });
  if (document.blobPathname) {
    const validUntil = Date.now() + 10 * 60_000;
    const signed = await issueSignedToken({ pathname: document.blobPathname, operations: ["get"], validUntil });
    const { presignedUrl } = await presignUrl(signed, { operation: "get", pathname: document.blobPathname, access: "private", validUntil });
    return NextResponse.redirect(presignedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
  }
  if (document.content) {
    return new NextResponse(Buffer.from(document.content), {
      headers: { "Content-Type": document.mimeType, "Content-Disposition": `attachment; filename="${encodeURIComponent(document.filename)}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
  }
  return new NextResponse("Fichier introuvable.", { status: 404 });
}
