import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { chooseConsultingService } from "@/app/(public)/rdv/actions";

/**
 * The link under each service of the palette (/rdv/conseil): records the
 * choice in the pending-slot cookie and moves the prospect on. A GET with a
 * cookie side effect only, no data is created here.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const token = request.nextUrl.searchParams.get("t") ?? undefined;
  const result = await chooseConsultingService({ code, token });
  const params = new URLSearchParams({ erreur: result.error });
  if (token) params.set("t", token);
  redirect(`/rdv/conseil?${params.toString()}`);
}
