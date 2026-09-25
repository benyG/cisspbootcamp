import { prisma } from "@/lib/db";
import { DEFAULT_START } from "@/lib/reading-plan/data";
import { isPlanDate, planStart, readingPlanPage } from "@/lib/reading-plan/page";

export const dynamic = "force-dynamic";

/**
 * The interactive CISSP reading plan (Ben, 25/09). Public, no account: the
 * onboarding e-mail links here with ?debut= set to the participant's cohort;
 * without it, the next CISSP cohort's dates are shown. Ticks stay in the
 * participant's browser, never on our side.
 */
export async function GET(request: Request): Promise<Response> {
  const debut = new URL(request.url).searchParams.get("debut");
  const start = isPlanDate(debut) ? debut : await nextCohortStart();
  return new Response(await readingPlanPage(start), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=300", "X-Robots-Tag": "noindex" },
  });
}

async function nextCohortStart(): Promise<string> {
  try {
    const cohort = await prisma.cohort.findFirst({
      where: { program: "cissp", status: { in: ["planned", "open", "full"] }, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true },
    });
    return cohort ? planStart(cohort.startsAt) : DEFAULT_START;
  } catch (error) {
    console.error("[plan-de-lecture] cohorte suivante", error);
    return DEFAULT_START;
  }
}
