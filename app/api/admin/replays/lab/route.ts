import { type HandleUploadBody, handleUpload } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { LAB_CONTENT_TYPES, LAB_MAX_BYTES } from "@/lib/replays";

/**
 * Token for the admin's browser to send a lab ZIP straight to private Blob
 * storage (Ben, 12/10): up to 2 GB, in pieces, never through a function.
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
        if (!/^replays\/labs\/\d+\//.test(pathname)) throw new Error("Chemin refusé");
        return { allowedContentTypes: LAB_CONTENT_TYPES, maximumSizeInBytes: LAB_MAX_BYTES, addRandomSuffix: true, validUntil: Date.now() + 60 * 60_000 };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Envoi refusé" }, { status: 400 });
  }
}
