"use server";

import { QUOTE_SEQUENCE, formatQuoteNumber } from "@/lib/admin-records";
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
export async function saveOfferAction(input: { quoteId: number; offer: unknown; markSent: boolean }): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  await requireAdmin();
  const quoteId = id.parse(input.quoteId);
  const parsed = offerSchema.safeParse(input.offer);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Offre invalide." };
  // The first save gives the offer its number, once (lot D): the same quote keeps it.
  const number = await prisma.$transaction(async (tx) => {
    const quote = await tx.quoteRequest.findUnique({ where: { id: quoteId }, select: { quoteNumber: true } });
    if (!quote) throw new Error("Demande introuvable.");
    let number = quote.quoteNumber;
    if (!number) {
      const seq = await tx.sequence.upsert({ where: { name: QUOTE_SEQUENCE }, create: { name: QUOTE_SEQUENCE, value: 1 }, update: { value: { increment: 1 } } });
      number = formatQuoteNumber(seq.value);
    }
    await tx.quoteRequest.update({ where: { id: quoteId }, data: { quoteNumber: number, offer: { ...parsed.data, reference: number }, ...(input.markSent ? { status: "sent" } : {}) } });
    return number;
  });
  revalidatePath("/admin/devis");
  return { ok: true, number };
}
