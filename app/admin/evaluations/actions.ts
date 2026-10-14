"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { MAX_QUESTIONS, MAX_TIMER_MINUTES, dueAtFromDay } from "@/lib/evaluations";
import { type Result, createEvaluation, sendInvite } from "@/lib/evaluations-server";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();
const schema = z.object({
  cohortId: id,
  title: z.string().trim().min(3, "Donnez un titre (3 caractères au moins).").max(120, "Titre trop long (120 caractères au plus)."),
  kind: z.enum(["test", "exam"]),
  split: z.enum(["weight", "equal", "hand"]),
  total: z.coerce.number().int().min(0).max(MAX_QUESTIONS),
  domainIds: z.array(id).min(1, "Choisissez au moins un domaine.").max(50),
  perDomain: z.record(z.string(), z.coerce.number().int().min(0).max(MAX_QUESTIONS)),
  timer: z.coerce.number().int().min(0).max(MAX_TIMER_MINUTES),
  dueDay: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date limite."),
  remind: z.boolean(),
  message: z.string().trim().max(1000),
  leadIds: z.array(id).min(1, "Choisissez au moins une personne inscrite.").max(500),
});

/** Builds the evaluation on ExamBoot and sends each person their link (Ben, 14/10). */
export async function createEvaluationAction(input: z.input<typeof schema>): Promise<Result> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const d = parsed.data;
  const dueAt = dueAtFromDay(d.dueDay);
  if (!dueAt) return { ok: false, error: "Date limite invalide." };
  const perDomain = Object.fromEntries(Object.entries(d.perDomain).map(([k, v]) => [Number(k), v]));
  const result = await createEvaluation({ ...d, perDomain, dueAt });
  revalidatePath("/admin/evaluations");
  return result;
}

export async function resendAction(input: { recipientId: number }): Promise<Result> {
  await requireAdmin();
  const result = await sendInvite(id.parse(input.recipientId), "invite");
  revalidatePath("/admin/evaluations");
  return result;
}
