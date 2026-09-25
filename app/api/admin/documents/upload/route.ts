import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES } from "@/lib/documents";

/**
 * Issues the short-lived token that lets the admin's browser send a document
 * straight to private Vercel Blob storage (Ben, 25/09: 30 MB per file). The
 * file never goes through a function, whose body is capped at 4.5 MB.
 * Only the signed-in admin gets a token; the record is created afterwards by
 * a server action that re-reads the blob's real size.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("documents/")) throw new Error("Chemin refusé");
        return {
          allowedContentTypes: Object.keys(ALLOWED_MIME_TYPES),
          maximumSizeInBytes: MAX_FILE_BYTES,
          addRandomSuffix: false,
          validUntil: Date.now() + 15 * 60_000,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi refusé" }, { status: 400 });
  }
}
