import { issueSignedToken, presignUrl } from "@vercel/blob";
import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { verifyDocumentLink } from "@/lib/document-links";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * A participant's personal download link, from the onboarding e-mail. The
 * signed token names the document and the lead; the document must still be
 * active and the lead must still hold a paid place. The file itself is then
 * served by private storage through a URL valid for ten minutes, so it never
 * transits this function and the link in the e-mail never expires on its own.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = verifyDocumentLink(token, env.AUTH_SECRET);
  if (!link) return gone("Ce lien n'est pas valide.");

  const [document, paid] = await Promise.all([
    prisma.document.findUnique({ where: { id: link.documentId }, select: { active: true, filename: true, mimeType: true, blobPathname: true, content: true } }),
    prisma.registration.findFirst({ where: { leadId: link.leadId, status: "paid" }, select: { id: true } }),
  ]);
  if (!document || !document.active || !paid) return gone("Ce document n'est plus disponible. Écrivez à Ben, il vous le renverra.");

  if (document.blobPathname) {
    const validUntil = Date.now() + 10 * 60_000;
    const signed = await issueSignedToken({ pathname: document.blobPathname, operations: ["get"], validUntil });
    const { presignedUrl } = await presignUrl(signed, { operation: "get", pathname: document.blobPathname, access: "private", validUntil });
    return NextResponse.redirect(presignedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
  }
  if (document.content) {
    return new NextResponse(Buffer.from(document.content), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(document.filename)}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  return gone("Ce document n'est plus disponible.");
}

function gone(message: string) {
  return new NextResponse(message, { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
