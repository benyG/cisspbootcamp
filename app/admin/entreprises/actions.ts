"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PACKAGE_CODES, SOVEREIGN_CODES, STATUSES, type Status, offerSchema } from "@/lib/enterprise";
import { loadOffer, markDepositPaid, prepareDeposit, saveOffer, saveProposal } from "@/lib/enterprise-server";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();
const back = (requestId: number, key: "ok" | "erreur", message: string) => redirect(`/admin/entreprises/${requestId}?${key}=${encodeURIComponent(message)}`);

/** Saves the proposal; its first save gives it a DEV number. */
export async function saveProposalAction(input: { id: number; proposal: unknown }): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  await requireAdmin();
  const result = await saveProposal(id.parse(input.id), input.proposal);
  revalidatePath(`/admin/entreprises/${input.id}`);
  return result;
}

/** Fixes the deposit from the saved proposal and returns the card payment link to send. */
export async function prepareDepositAction(input: { id: number }): Promise<{ ok: true; url: string; amount: string } | { ok: false; error: string }> {
  await requireAdmin();
  const result = await prepareDeposit(id.parse(input.id), await loadOffer());
  revalidatePath(`/admin/entreprises/${input.id}`);
  return result;
}

export async function updateRequestAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const requestId = id.parse(formData.get("id"));
  const status = z.enum(Object.keys(STATUSES) as [Status, ...Status[]]).parse(formData.get("status"));
  const note = z.string().trim().max(4000).parse(formData.get("note") ?? "");
  await prisma.enterpriseRequest.update({ where: { id: requestId }, data: { status, note: note || null } });
  revalidatePath("/admin/entreprises");
  back(requestId, "ok", "Demande mise à jour.");
}

/** A transfer received: Ben confirms it by hand (fallback), with a note. Never from the browser of the client. */
export async function confirmDepositAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const requestId = id.parse(formData.get("id"));
  const note = z.string().trim().min(3).max(300).safeParse(formData.get("note"));
  if (!note.success) back(requestId, "erreur", "Précisez la preuve du paiement (ex. : virement reçu le 24/11, réf. banque).");
  const r = await prisma.enterpriseRequest.findUnique({ where: { id: requestId }, select: { depositReference: true, depositUsd: true } });
  if (!r?.depositReference || !r.depositUsd) back(requestId, "erreur", "Créez d’abord le lien d’acompte : il fixe le montant.");
  const result = await markDepositPaid({ reference: r!.depositReference!, amountPaidUsdCents: r!.depositUsd!, paidAt: new Date(), manualNote: note.data! });
  revalidatePath("/admin/entreprises");
  if (!result.ok) back(requestId, "erreur", result.error);
  back(requestId, "ok", "Acompte confirmé : la demande est signée et le reçu est émis.");
}

/** Personal data: a request is deleted on demand (CLAUDE.md, données personnelles). The lead stays, with its own deletion. */
export async function deleteRequestAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const requestId = id.parse(formData.get("id"));
  if (formData.get("confirm") !== "on") back(requestId, "erreur", "Cochez la case pour confirmer la suppression.");
  const r = await prisma.enterpriseRequest.findUnique({ where: { id: requestId }, select: { depositPaidAt: true } });
  if (r?.depositPaidAt) back(requestId, "erreur", "Acompte payé : la demande reste liée à son reçu (obligation comptable).");
  await prisma.enterpriseRequest.delete({ where: { id: requestId } });
  revalidatePath("/admin/entreprises");
  redirect(`/admin/entreprises?ok=${encodeURIComponent("Demande supprimée.")}`);
}

const usd = (v: FormDataEntryValue | null) => Math.round((Number(String(v ?? "").replace(/[\s ]/g, "").replace(",", ".")) || 0) * 100);
const lines = (v: FormDataEntryValue | null) => String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

/** The catalogue: the five steps and their prices, shown on the page and used by proposals. */
export async function saveOfferAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const featured = formData.get("featured");
  const pkg = (code: string) => ({
      code,
      name: formData.get(`${code}.name`),
      duration: formData.get(`${code}.duration`),
      items: lines(formData.get(`${code}.items`)),
      outcome: formData.get(`${code}.outcome`),
      africaUsd: usd(formData.get(`${code}.africa`)),
      intlUsd: usd(formData.get(`${code}.intl`)),
      from: formData.get(`${code}.from`) === "on",
      monthly: formData.get(`${code}.monthly`) === "on",
      weeks: Number(formData.get(`${code}.weeks`)) || 0,
      featured: featured === code,
    });
  const raw = {
    packages: PACKAGE_CODES.map(pkg),
    sovereign: SOVEREIGN_CODES.map(pkg),
    showSovereign: formData.get("showSovereign") === "on",
    options: [0, 1, 2, 3].map((i) => ({ name: String(formData.get(`opt${i}.name`) ?? "").trim(), text: String(formData.get(`opt${i}.text`) ?? "").trim() })).filter((o) => o.name && o.text),
  };
  const parsed = offerSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    redirect(`/admin/entreprises/offre?erreur=${encodeURIComponent(`${issue?.path.join(" › ")} : ${issue?.message}`)}`);
  }
  await saveOffer(parsed.data);
  revalidatePath("/admin/entreprises/offre");
  revalidatePath("/ia/entreprises");
  redirect(`/admin/entreprises/offre?ok=${encodeURIComponent("Catalogue enregistré : la page publique affiche ces prix.")}`);
}
