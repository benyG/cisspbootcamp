"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { createPartnerCode as createPartner, createReferralCodes as createReferrals, setPromoActive } from "@/lib/admin-ops/promos";
import { PROGRAM_CODES } from "@/lib/programs";
import { MAX_PERCENT } from "@/lib/promo";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const back = (message: string, ok = false): never => redirect(`/admin/promos?${ok ? "ok" : "erreur"}=${encodeURIComponent(message)}`);

/** A partner's code (lot 6): a percentage, a programme or all, an end date, a number of uses. */
export async function createPartnerCode(formData: FormData): Promise<void> {
  await requireAdmin();
  const raw = Object.fromEntries(["code", "label", "percent", "program", "validUntil", "maxUses"].map((k) => [k, formData.get(k)]));
  const empty = (v: FormDataEntryValue | null) => (v === "" || v === null ? null : v);
  const result = await createPartner({ code: String(raw.code ?? ""), label: String(raw.label ?? ""), percent: raw.percent as never, program: empty(raw.program) as never, validUntil: empty(raw.validUntil) as never, maxUses: empty(raw.maxUses) as never });
  revalidatePath("/admin/promos");
  back(result.ok ? result.message : result.error, result.ok);
}

/** One referral code per alumnus of a programme (lot 6). */
export async function createReferralCodes(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.object({ program: z.enum(PROGRAM_CODES), percent: z.coerce.number().int().min(1).max(MAX_PERCENT) }).safeParse({ program: formData.get("program"), percent: formData.get("percent") });
  if (!parsed.success) back("Choisissez le programme et une remise de 1 à 50 %.");
  const result = await createReferrals(parsed.data!.program, parsed.data!.percent);
  revalidatePath("/admin/promos");
  back(result.ok ? result.message : result.error, result.ok);
}

export async function togglePromoCode(formData: FormData): Promise<void> {
  await requireAdmin();
  await setPromoActive({ id: z.coerce.number().int().positive().parse(formData.get("id")) });
  revalidatePath("/admin/promos");
}
