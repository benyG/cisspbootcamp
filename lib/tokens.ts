import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Opaque tokens addressing a prospect's private pages: scanner result,
 * reschedule link, unsubscribe link. There is no public account in V1, so a
 * token *is* the credential (SPECS A2, A3, A10).
 *
 * 256 bits of randomness, stored alongside the row it unlocks rather than
 * signed: a stored token can be revoked by deleting it, which a self-contained
 * signed token cannot. That matters for the one-click deletion the RGPD
 * section requires.
 */
const TOKEN_BYTES = 32;

export function createToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/**
 * Constant-time comparison, for secrets that arrive from outside — notably the
 * Netticket `verif-hash` header (see docs/NETTICKET.md).
 */
export function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
