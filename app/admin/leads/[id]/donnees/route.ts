import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { leadDataExport } from "@/lib/admin-records-server";

export const dynamic = "force-dynamic";

/** Everything held on one person, as JSON, to answer an access request (lot B). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(new URL("/admin/connexion", request.nextUrl.origin));
  const { id } = await params;
  const data = await leadDataExport(Number(id) || 0);
  if (!data) return new NextResponse("Prospect introuvable", { status: 404 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="donnees-${id}.json"`, "Cache-Control": "private, no-store" },
  });
}
