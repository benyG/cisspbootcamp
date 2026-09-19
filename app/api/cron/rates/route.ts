import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { CFA_PER_EUR, LOCAL_CURRENCY_BY_COUNTRY } from "@/lib/pricing";
import { safeEquals } from "@/lib/tokens";

export const dynamic = "force-dynamic";

const FEED = "https://open.er-api.com/v6/latest/USD";

/**
 * Daily refresh of the indicative local amounts (SPECS A4). Any currency the
 * feed omits keeps its previous value; XAF/XOF are always re-derived from EUR
 * by their treaty peg, so the biggest market never depends on the feed.
 */
export async function GET(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  if (!env.CRON_SECRET || !safeEquals(header, `Bearer ${env.CRON_SECRET}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const wanted = new Set(Object.values(LOCAL_CURRENCY_BY_COUNTRY));
  const response = await fetch(FEED, { next: { revalidate: 0 } });
  if (!response.ok) return NextResponse.json({ error: `feed ${response.status}` }, { status: 502 });

  const data = (await response.json()) as { result: string; rates?: Record<string, number> };
  if (data.result !== "success" || !data.rates) return NextResponse.json({ error: "feed" }, { status: 502 });

  const rates: Record<string, number> = {};
  for (const currency of wanted) {
    const value = data.rates[currency];
    if (typeof value === "number" && value > 0) rates[currency] = value;
  }
  if (rates.EUR) {
    rates.XAF = rates.EUR * CFA_PER_EUR;
    rates.XOF = rates.EUR * CFA_PER_EUR;
  }

  await prisma.$transaction(
    Object.entries(rates).map(([currency, perUsd]) =>
      prisma.exchangeRate.upsert({ where: { currency }, create: { currency, perUsd }, update: { perUsd } }),
    ),
  );

  return NextResponse.json({ updated: Object.keys(rates).length });
}
