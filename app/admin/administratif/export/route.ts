import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { accountantCsv, monthBounds } from "@/lib/admin-records";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The month's numbered receipts as CSV, for the accountant (lot B). ?mois=2026-11 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(new URL("/admin/connexion", request.nextUrl.origin));
  const month = request.nextUrl.searchParams.get("mois") ?? new Date().toISOString().slice(0, 7);
  const bounds = monthBounds(month);
  if (!bounds) return new NextResponse("Mois invalide (AAAA-MM)", { status: 400 });
  const rows = await prisma.receipt.findMany({ where: { paidAt: { gte: bounds.from, lt: bounds.to } }, orderBy: { number: "asc" } });
  return new NextResponse(accountantCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="recus-${month}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
