import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { readVideo } from "@/lib/minimax";

export const dynamic = "force-dynamic";

/** A generated clip, for the admin only: the files sit in private storage. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(new URL("/admin/connexion", request.nextUrl.origin));
  const { id } = await params;
  const video = await prisma.marketingVideo.findUnique({ where: { id: Number(id) || 0 } });
  if (!video?.blobPathname) return new NextResponse("Vidéo introuvable", { status: 404 });
  const stream = await readVideo(video.blobPathname);
  if (!stream) return new NextResponse("Vidéo introuvable", { status: 404 });
  const download = request.nextUrl.searchParams.has("telecharger");
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "private, max-age=3600",
      ...(download ? { "Content-Disposition": `attachment; filename="cisspbootcamp-plan-${video.id}.mp4"` } : {}),
    },
  });
}
