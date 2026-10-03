import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { readStored } from "@/lib/minimax";

export const dynamic = "force-dynamic";

/** A generated visual, for the admin only (private storage); ?photo gives the raw photograph. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(new URL("/admin/connexion", request.nextUrl.origin));
  const { id } = await params;
  const image = await prisma.marketingImage.findUnique({ where: { id: Number(id) || 0 } });
  if (!image) return new NextResponse("Image introuvable", { status: 404 });
  const raw = request.nextUrl.searchParams.has("photo");
  const pathname = raw ? image.photoPathname : image.imagePathname;
  const stream = await readStored(pathname);
  if (!stream) return new NextResponse("Image introuvable", { status: 404 });
  const type = pathname.endsWith(".png") ? "image/png" : "image/jpeg";
  const download = request.nextUrl.searchParams.has("telecharger");
  return new NextResponse(stream, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=3600",
      ...(download ? { "Content-Disposition": `attachment; filename="cisspbootcamp-${raw ? "photo" : "visuel"}-${image.id}.${type === "image/png" ? "png" : "jpg"}"` } : {}),
    },
  });
}
