"use server";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { authorizeSchema, redirectWith } from "@/lib/mcp/oauth";
import { findClient, issueCode, revokeClient } from "@/lib/mcp/oauth-server";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

/** Everything re-checked from the form: hidden fields are never trusted. */
async function readRequest(formData: FormData) {
  const parsed = authorizeSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)])));
  if (!parsed.success) throw new Error("Demande d’autorisation invalide.");
  const client = await findClient(parsed.data.client_id);
  if (!client || !client.redirectUris.includes(parsed.data.redirect_uri)) throw new Error("Application ou adresse de retour inconnue.");
  return parsed.data;
}

/** "Autoriser": a one-time code goes back to the application. */
export async function approveMcpAccess(formData: FormData) {
  await requireAdmin();
  const req = await readRequest(formData);
  const code = await issueCode({ clientId: req.client_id, redirectUri: req.redirect_uri, codeChallenge: req.code_challenge });
  redirect(redirectWith(req.redirect_uri, { code, state: req.state }));
}

/** "Refuser": the application is told no. */
export async function denyMcpAccess(formData: FormData) {
  await requireAdmin();
  const req = await readRequest(formData);
  redirect(redirectWith(req.redirect_uri, { error: "access_denied", state: req.state }));
}

/** "Déconnecter" on /admin/mcp. */
export async function disconnectMcpClient(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (clientId) await revokeClient(clientId);
  redirect("/admin/mcp?ok=" + encodeURIComponent("Application déconnectée."));
}
