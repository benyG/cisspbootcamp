import { readCampaign } from "@/lib/campaign";
import { prisma } from "@/lib/db";
import { type Promo, bestPromo, codeProblem, launchPercent, normalizeCode } from "@/lib/promo";

/**
 * The promo shown on a registration page before the person is known (CC,
 * Bâtisseur IA): the cohort's launch price and the code typed. The
 * checkout checks it again with the person (lib/registration.ts).
 */
export async function promoPreview(input: { program: string; cohortId: number | null | undefined; listUsdCents: number; code: string | null | undefined; now?: Date }): Promise<{ promo: Promo | null; error: string | null; code: string | null }> {
  const now = input.now ?? new Date();
  const cohort = input.cohortId ? await prisma.cohort.findUnique({ where: { id: input.cohortId }, select: { campaign: true } }).catch(() => null) : null;
  const launch = launchPercent(readCampaign(cohort?.campaign)?.promo.early, now);
  const code = input.code ? normalizeCode(input.code) : null;
  let error: string | null = input.code && !code ? "Ce code n’existe pas ou n’est plus actif." : null;
  let row: { code: string; percent: number; kind: string } | null = null;
  if (code) {
    const found = await prisma.promoCode.findUnique({ where: { code } }).catch(() => null);
    const usedCount = found ? await prisma.registration.count({ where: { promoCode: found.code, status: "paid" } }) : 0;
    error = codeProblem(found, { program: input.program, leadId: -1, usedCount }, now);
    if (!error && found) row = { code: found.code, percent: found.percent, kind: found.kind };
  }
  return { promo: bestPromo({ listUsdCents: input.listUsdCents, creditUsdCents: 0, launch, code: row }), error, code: error ? null : code };
}
