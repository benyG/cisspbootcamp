import { prisma } from "@/lib/db";
import { DEFAULT_START } from "@/lib/reading-plan/data";
import { isPlanDate, planStart, readingPlanPage } from "@/lib/reading-plan/page";

export const dynamic = "force-dynamic";

/**
 * The interactive CISSP reading plan (Ben, 25/09). Public, no account: the
 * onboarding e-mail links here with ?cohorte= (the cohort's current start,
 * so a moved start moves the plan) and ?debut= as the fallback; without
 * either, the next CISSP cohort's dates are shown. Ticks stay in the
 * participant's browser, never on our side.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const debut = params.get("debut");
  const start = (await cohortStart(params.get("cohorte"))) ?? (isPlanDate(debut) ? debut : await nextCohortStart());
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

async function cohortStart(raw: string | null): Promise<string | null> {
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id <= 0) return null;
  try {
    const cohort = await prisma.cohort.findFirst({ where: { id, program: "cissp" }, select: { startsAt: true } });
    return cohort ? planStart(cohort.startsAt) : null;
  } catch (error) {
    console.error("[plan-de-lecture] cohorte", error);
    return null;
  }
}
