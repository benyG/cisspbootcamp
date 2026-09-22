import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { checkTransaction } from "@/lib/payments/netticket";
import { markRegistrationPaid } from "@/lib/registration";
import { safeEquals } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/** Poll pending mobile-money payments for 24 h (SPECS A4), from the GitHub Actions tick. */
export async function GET(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEquals(header, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.NETTICKET_API_KEY) return NextResponse.json({ skipped: "not configured" });

  const since = new Date(Date.now() - 24 * 3_600_000);
  const pending = await prisma.registration.findMany({
    where: { method: "netticket", status: "pending", netticketTransactionId: { not: null }, createdAt: { gte: since } },
    take: 50,
  });

  let paid = 0;
  for (const r of pending) {
    const status = await checkTransaction(r.netticketTransactionId as string);
    if (status === "successful") {
      const result = await markRegistrationPaid({ reference: r.reference, amountPaidUsdCents: r.amountUsd, paidAt: new Date(), netticketTransactionId: r.netticketTransactionId ?? undefined });
      if (result.ok) paid++;
    }
  }
  return NextResponse.json({ checked: pending.length, paid });
}
