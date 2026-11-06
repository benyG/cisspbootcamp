"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PROGRAM_CODES } from "@/lib/programs";
import { MAX_PERCENT, normalizeCode, referralCode } from "@/lib/promo";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const back = (message: string, ok = false): never => redirect(`/admin/promos?${ok ? "ok" : "erreur"}=${encodeURIComponent(message)}`);
const optionalDate = z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.date().nullable());
const optionalInt = z.preprocess((v) => (v === "" || v === null ? null : v), z.coerce.number().int().min(1).max(10_000).nullable());
const programField = z.preprocess((v) => (v === "" || v === null ? null : v), z.enum(PROGRAM_CODES).nullable());

/** A partner's code (lot 6): a percentage, a programme or all, an end date, a number of uses. */
export async function createPartnerCode(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({
    code: z.string().transform((v, ctx) => normalizeCode(v) ?? (ctx.addIssue({ code: "custom", message: "Code : 3 à 24 lettres, chiffres ou tirets." }), z.NEVER)),
    label: z.string().trim().min(1, "Nom du partenaire requis").max(120),
    percent: z.coerce.number().int().min(1, "Remise : au moins 1 %").max(MAX_PERCENT, `Remise : au plus ${MAX_PERCENT} %`),
    program: programField,
    validUntil: optionalDate,
    maxUses: optionalInt,
  }).safeParse(Object.fromEntries(["code", "label", "percent", "program", "validUntil", "maxUses"].map((k) => [k, formData.get(k)])));
  if (!parsed.success) back(parsed.error.issues[0]?.message ?? "Données invalides");
  const d = parsed.data!;
  if (await prisma.promoCode.findUnique({ where: { code: d.code } })) back(`Le code ${d.code} existe déjà.`);
  await prisma.promoCode.create({ data: { ...d, kind: "partner", validUntil: d.validUntil ? new Date(d.validUntil.getTime() + 86_399_999) : null } });
  revalidatePath("/admin/promos");
  back(`Code ${d.code} créé.`, true);
}

/**
 * One referral code per alumnus of a programme (lot 6): people with a paid
 * seat in a cohort that has started, who have no code yet and have not
 * unsubscribed. The discount goes to the person they recommend.
 */
export async function createReferralCodes(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ program: z.enum(PROGRAM_CODES), percent: z.coerce.number().int().min(1).max(MAX_PERCENT) }).safeParse({ program: formData.get("program"), percent: formData.get("percent") });
  if (!parsed.success) back("Choisissez le programme et une remise de 1 à 50 %.");
  const { program, percent } = parsed.data!;
  const alumni = await prisma.lead.findMany({
    where: { unsubscribedAt: null, registrations: { some: { status: "paid", cohort: { program, startsAt: { lt: new Date() } } } } },
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
  revalidatePath("/admin/promos");
  back(created ? `${created} code${created > 1 ? "s" : ""} de parrainage créé${created > 1 ? "s" : ""}.` : "Tous les anciens de ce programme ont déjà leur code.", true);
}

export async function togglePromoCode(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  const row = await prisma.promoCode.findUnique({ where: { id }, select: { active: true } });
  if (row) await prisma.promoCode.update({ where: { id }, data: { active: !row.active } });
  revalidatePath("/admin/promos");
}
