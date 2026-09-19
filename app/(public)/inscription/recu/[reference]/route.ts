import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { buildReceiptPdf } from "@/lib/payments/receipt";
import { formatLocal } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/** Receipt as PDF, by reference. Only for paid registrations. */
export async function GET(_request: Request, { params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const registration = await prisma.registration.findUnique({
    where: { reference },
    include: { lead: true, cohort: true },
  });
  if (!registration || registration.status !== "paid" || !registration.paidAt) {
    return new NextResponse("Reçu introuvable", { status: 404 });
  }

  const pdf = await buildReceiptPdf({
    reference: registration.reference,
    paidAt: registration.paidAt,
    method: registration.method,
    amountUsdCents: registration.amountUsd,
    amountLocalLabel:
      registration.currencyLocal && registration.amountLocal !== null
        ? formatLocal(registration.amountLocal, registration.currencyLocal)
        : null,
    participantName: `${registration.lead.firstName} ${registration.lead.lastName}`,
    participantEmail: registration.lead.email,
    company: null,
    cohortName: registration.cohort.name,
    issuerName: "Ben — Coach CISSP",
    issuerEmail: (process.env.EMAIL_FROM ?? "").replace(/.*<|>.*/g, "") || `bonjour@${new URL(env.NEXT_PUBLIC_APP_URL).hostname}`,
  });

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="recu-${registration.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
