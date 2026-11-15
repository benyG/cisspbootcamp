import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { loadBusiness } from "@/lib/admin-records-server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { buildReceiptPdf } from "@/lib/payments/receipt";

export const dynamic = "force-dynamic";

/** An archived receipt, rebuilt from its copy (lot B): readable even once the lead is anonymised. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ number: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.redirect(new URL("/admin/connexion", request.nextUrl.origin));
  const { number } = await params;
  const r = await prisma.receipt.findUnique({ where: { number } });
  if (!r) return new NextResponse("Reçu introuvable", { status: 404 });
  const business = await loadBusiness();
  const pdf = await buildReceiptPdf({
    numbers: [r.number],
    reference: r.reference,
    paidAt: r.paidAt,
    method: r.method,
    paymentNote: r.paymentNote,
    amountUsdCents: r.amountUsd,
    amountLocalLabel: null,
    participantName: r.buyerName,
    participantEmail: r.buyerEmail,
    company: null,
    cohortName: "",
    label: r.label,
    issuerName: business.legalName || "CISSP Bootcamp",
    issuerEmail: business.email || (process.env.EMAIL_FROM ?? "").replace(/.*<|>.*/g, "") || `bonjour@${new URL(env.NEXT_PUBLIC_APP_URL).hostname}`,
    business,
  });
  return new NextResponse(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.number}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
