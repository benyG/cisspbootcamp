"use server";

import { redirect } from "next/navigation";

import type { BookResult } from "@/lib/booking";
import { requestSchema } from "@/lib/enterprise";
import { bookEnterpriseCall, createRequest, startDepositCheckout } from "@/lib/enterprise-server";
import { iaPath } from "@/lib/ia-domain";

export type RequestState = { error?: string; fields?: Record<string, string> };

/** The page's form: the request is saved (with consent), then the person picks a call slot. */
export async function submitRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const fields = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")) as Record<string, string>;
  const parsed = requestSchema.safeParse({ ...fields, functions: formData.getAll("functions") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vérifiez le formulaire.", fields };
  let token: string;
  try {
    ({ token } = await createRequest(parsed.data));
  } catch (error) {
    console.error("[entreprises] demande", error);
    return { error: "La demande n’a pas pu être enregistrée. Réessayez dans un instant.", fields };
  }
  redirect(iaPath(`/ia/entreprises/appel/${token}`));
}

export async function bookCall(input: { token: string; start: string; timezone: string }): Promise<BookResult> {
  const start = new Date(input.start);
  if (Number.isNaN(start.getTime()) || !input.timezone) return { ok: false, error: "Créneau invalide." };
  return bookEnterpriseCall({ token: input.token, start, timezone: input.timezone.slice(0, 64) });
}

/** Card payment of the deposit; `paid` only ever comes from the Stripe webhook. */
export async function payDeposit(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const result = await startDepositCheckout(token);
  if (!result.ok) redirect(iaPath(`/ia/entreprises/acompte/${token}?erreur=1`));
  redirect(result.url);
}
