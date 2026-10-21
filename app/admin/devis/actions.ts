"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { offerSchema } from "@/lib/offer";
import { STATUSES, type QuoteStatus, deleteQuote, setQuoteStatus } from "@/lib/quotes";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const id = z.coerce.number().int().positive();

export async function updateQuoteAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const quoteId = id.parse(formData.get("id"));
  const status = z.enum(Object.keys(STATUSES) as [QuoteStatus, ...QuoteStatus[]]).parse(formData.get("status"));
  const note = z.string().trim().max(4000).parse(formData.get("note") ?? "");
  await setQuoteStatus(quoteId, status, note || null);
  revalidatePath("/admin/devis");
  redirect(`/admin/devis?id=${quoteId}&ok=${encodeURIComponent("Demande mise à jour.")}`);
}

/** Personal data: a request is deleted on demand, with its note (CLAUDE.md, données personnelles). */
export async function deleteQuoteAction(formData: FormData): Promise<void> {
  await requireAdmin();
  if (formData.get("confirm") !== "on") redirect(`/admin/devis?id=${formData.get("id")}&erreur=${encodeURIComponent("Cochez la case pour confirmer la suppression.")}`);
  await deleteQuote(id.parse(formData.get("id")));
  revalidatePath("/admin/devis");
  redirect(`/admin/devis?ok=${encodeURIComponent("Demande supprimée.")}`);
}

/** Keeps the offer prepared for a request, to print it again later (Ben, 21/10). */
export async function saveOfferAction(input: { quoteId: number; offer: unknown; markSent: boolean }): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const quoteId = id.parse(input.quoteId);
  const parsed = offerSchema.safeParse(input.offer);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Offre invalide." };
  await prisma.quoteRequest.update({ where: { id: quoteId }, data: { offer: parsed.data, ...(input.markSent ? { status: "sent" } : {}) } });
  revalidatePath("/admin/devis");
  return { ok: true };
}
