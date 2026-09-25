import { createHmac } from "node:crypto";

import { safeEquals } from "@/lib/tokens";

/**
 * Personal download links for preparation documents (Ben, 25/09): the
 * onboarding e-mail carries /documents/<token> for files too large to attach.
 * The token names the document and the lead, and is signed with AUTH_SECRET,
 * so a link cannot be forged or pointed at another file. The route re-checks
 * that the document is active and the lead still has a paid place.
 */
export function signDocumentLink(documentId: number, leadId: number, secret: string): string {
  const payload = `${documentId}.${leadId}`;
  return `${payload}.${mac(payload, secret)}`;
}

export function verifyDocumentLink(token: string, secret: string): { documentId: number; leadId: number } | null {
  const match = /^(\d{1,10})\.(\d{1,10})\.([\w-]{20,64})$/.exec(token);
  if (!match) return null;
  const payload = `${match[1]}.${match[2]}`;
  if (!safeEquals(match[3], mac(payload, secret))) return null;
  return { documentId: Number(match[1]), leadId: Number(match[2]) };
}

function mac(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(`document-link:${payload}`).digest("base64url").slice(0, 32);
}
