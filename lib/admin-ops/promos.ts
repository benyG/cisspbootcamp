import { z } from "zod";

import { prisma } from "@/lib/db";
import { PROGRAM_CODES, type ProgramCode } from "@/lib/programs";
import { MAX_PERCENT, normalizeCode, referralCode } from "@/lib/promo";

import type { OpResult } from "./leads";

/** Promo codes (lot 6), for the admin page and the MCP plug. */

export const partnerCodeSchema = z.object({
  code: z.string().transform((v, ctx) => normalizeCode(v) ?? (ctx.addIssue({ code: "custom", message: "Code : 3 à 24 lettres, chiffres ou tirets." }), z.NEVER)),
  label: z.string().trim().min(1, "Nom du partenaire requis").max(120),
  percent: z.coerce.number().int().min(1, "Remise : au moins 1 %").max(MAX_PERCENT, `Remise : au plus ${MAX_PERCENT} %`),
  program: z.enum(PROGRAM_CODES).nullable(),
  validUntil: z.coerce.date().nullable(),
  maxUses: z.coerce.number().int().min(1).max(10_000).nullable(),
});

/** A partner's code: a percentage, a programme or all, an end date (end of that day), a number of uses. */
export async function createPartnerCode(input: z.input<typeof partnerCodeSchema>): Promise<OpResult> {
  const parsed = partnerCodeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides" };
  const d = parsed.data;
  if (await prisma.promoCode.findUnique({ where: { code: d.code } })) return { ok: false, error: `Le code ${d.code} existe déjà.` };
  await prisma.promoCode.create({ data: { ...d, kind: "partner", validUntil: d.validUntil ? new Date(d.validUntil.getTime() + 86_399_999) : null } });
  return { ok: true, message: `Code ${d.code} créé.` };
}

/**
 * One referral code per alumnus of a programme: people with a paid seat in a
 * cohort that has started, who have no code yet and have not unsubscribed.
 */
export async function createReferralCodes(program: ProgramCode, percent: number, now = new Date()): Promise<OpResult> {
  if (!Number.isInteger(percent) || percent < 1 || percent > MAX_PERCENT) return { ok: false, error: `Remise de 1 à ${MAX_PERCENT} %.` };
  const alumni = await prisma.lead.findMany({
    where: { unsubscribedAt: null, registrations: { some: { status: "paid", cohort: { program, startsAt: { lt: now } } } } },
    select: { id: true, firstName: true, lastName: true },
  });
  const existing = new Set((await prisma.promoCode.findMany({ where: { kind: "referral", referrerLeadId: { in: alumni.map((a) => a.id) } }, select: { referrerLeadId: true } })).map((c) => c.referrerLeadId));
  let created = 0;
  for (const a of alumni.filter((x) => !existing.has(x.id))) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = referralCode(a.firstName);
      if (await prisma.promoCode.findUnique({ where: { code } })) continue;
      await prisma.promoCode.create({ data: { code, kind: "referral", label: `${a.firstName} ${a.lastName}`.trim(), percent, program, referrerLeadId: a.id } });
      created++;
      break;
    }
  }
  return { ok: true, message: created ? `${created} code${created > 1 ? "s" : ""} de parrainage créé${created > 1 ? "s" : ""}.` : "Tous les anciens de ce programme ont déjà leur code." };
}

/** On or off; by id or by code. */
export async function setPromoActive(where: { id: number } | { code: string }, active?: boolean): Promise<OpResult> {
  const row = await prisma.promoCode.findUnique({ where, select: { id: true, code: true, active: true } });
  if (!row) return { ok: false, error: "Code promo introuvable." };
  const next = active ?? !row.active;
  await prisma.promoCode.update({ where: { id: row.id }, data: { active: next } });
  return { ok: true, message: `Code ${row.code} ${next ? "activé" : "désactivé"}.` };
}
