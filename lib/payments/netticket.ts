import { safeEquals } from "@/lib/tokens";

/**
 * Netticket mobile money — SPECS A4, contract in docs/NETTICKET.md.
 *
 * Netticket is a ticketing platform: a payment buys one `ticket_code` of an
 * event, priced in XAF on their side. Two rules from CLAUDE.md drive this file:
 *   - `paid` only after a confirmation we verified server-side. The webhook's
 *     `verif-hash` is a shared secret, not a signature, so a webhook alone is
 *     never enough: we re-check the transaction with GET /payment/{id}/check.
 *   - the card endpoint is never used (PCI scope); cards go through Stripe.
 */

const BASE = "https://netticket.net/api";

/** Netticket `modality` values for mobile money. */
export const MODALITY = { mtn: 3, orange: 4 } as const;
export type Operator = keyof typeof MODALITY;

/** Countries where Netticket's operators and currency (XAF) apply. */
export const NETTICKET_COUNTRIES = new Set(["CM", "GA", "CG", "TD", "CF", "GQ"]);

export function mobileMoneyAvailable(country: string | null | undefined, ticketCode: string | null | undefined): boolean {
  return Boolean(ticketCode) && Boolean(process.env.NETTICKET_API_KEY) && NETTICKET_COUNTRIES.has((country ?? "").toUpperCase());
}

export class NetticketNotConfiguredError extends Error {
  constructor() {
    super("NETTICKET_API_KEY manquante");
    this.name = "NetticketNotConfiguredError";
  }
}

function headers(): HeadersInit {
  const key = process.env.NETTICKET_API_KEY;
  if (!key) throw new NetticketNotConfiguredError();
  return { "x-api-key": key, "Content-Type": "application/json", Accept: "application/json" };
}

export type MobilePaymentResult =
  | { status: "success"; transactionId: string; reference: string }
  | { status: "pending"; transactionId: string | null; reference: string | null }
  | { status: "failed"; message: string };

/**
 * POST /payment/mobile. `phone` is the local number, e.g. 6xxxxxxxx.
 * 200 = paid on the spot (still re-checked before we mark it), 210 = the
 * customer must confirm on their phone: we poll.
 */
export async function createMobilePayment(input: {
  email: string;
  phone: string;
  ticketCode: string;
  operator: Operator;
  name: string;
}): Promise<MobilePaymentResult> {
  const response = await fetch(`${BASE}/payment/mobile`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      email: input.email,
      phone: Number(input.phone.replace(/\D/g, "")),
      ticket_code: input.ticketCode,
      modality: MODALITY[input.operator],
      quantity: 1,
      name: input.name,
      notification: true,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    success?: string;
    pending?: string;
    message?: string;
    error?: string;
    data?: { transaction_id?: number | string; reference?: string };
  };
  const transactionId = body.data?.transaction_id !== undefined ? String(body.data.transaction_id) : null;
  const reference = body.data?.reference ?? null;

  if (response.status === 200 && transactionId && reference) return { status: "success", transactionId, reference };
  if (response.status === 210) return { status: "pending", transactionId, reference };
  return { status: "failed", message: body.message ?? body.error ?? `Netticket ${response.status}` };
}

/** GET /payment/{transaction_id}/check — the server-side truth. */
export async function checkTransaction(transactionId: string): Promise<"successful" | "failed" | "unknown"> {
  const response = await fetch(`${BASE}/payment/${encodeURIComponent(transactionId)}/check`, { headers: headers() });
  if (response.status === 200) return "successful";
  if (response.status === 400) return "failed";
  return "unknown";
}

export type NetticketWebhook = { id: string; status: "successful" | "failed" | "cancelled" | "abandoned"; txRef: string; amount: number; currency: string };

/**
 * Parse and authenticate the webhook. The header is compared in constant time
 * to NETTICKET_WEBHOOK_SECRET; a mismatch or an unknown shape returns null.
 */
export function parseWebhook(rawBody: string, verifHash: string | null): NetticketWebhook | null {
  const secret = process.env.NETTICKET_WEBHOOK_SECRET;
  if (!secret || !verifHash || !safeEquals(verifHash, secret)) return null;

  let body: { event?: string; data?: { id?: string | number; status?: string; tx_ref?: string; amount?: number; charged_amount?: number; currency?: string } };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return null;
  }
  const d = body.data;
  if (!d || d.id === undefined || !d.status || !d.tx_ref) return null;
  const status = d.status as NetticketWebhook["status"];
  if (!["successful", "failed", "cancelled", "abandoned"].includes(status)) return null;

  return { id: String(d.id), status, txRef: d.tx_ref, amount: Number(d.charged_amount ?? d.amount ?? 0), currency: String(d.currency ?? "xaf").toUpperCase() };
}

/** Fallback (SPECS A4): Netticket's own purchase page, our reference carried along. */
export function fallbackUrl(reference: string): string | null {
  const base = process.env.NETTICKET_FALLBACK_URL;
  if (!base) return null;
  const url = new URL(base);
  url.searchParams.set("ref", reference);
  return url.toString();
}
