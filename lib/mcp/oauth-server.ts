import { prisma } from "@/lib/db";
import { safeEquals } from "@/lib/tokens";

import { ACCESS_TTL_MS, CODE_TTL_MS, MAX_REGISTRATIONS_PER_DAY, REFRESH_TTL_MS, newSecret, pkceMatches, redirectUriAllowed, registrationSchema, sha256 } from "./oauth";

/**
 * Storage side of the MCP plug's OAuth (docs/MCP.md). Codes and tokens are
 * kept as sha256 only; a refresh token works once, and a second use of the
 * same one cuts the client off (it was copied).
 */

type OAuthError = { error: string; error_description: string };
const fail = (error: string, error_description: string): OAuthError => ({ error, error_description });

export async function registerClient(body: unknown, now = new Date()) {
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) return fail("invalid_client_metadata", "Champs d’enregistrement invalides.");
  const bad = parsed.data.redirect_uris.find((u) => !redirectUriAllowed(u));
  if (bad) return fail("invalid_redirect_uri", `Adresse de retour refusée : ${bad}`);
  const recent = await prisma.mcpClient.count({ where: { createdAt: { gte: new Date(now.getTime() - 86_400_000) } } });
  if (recent >= MAX_REGISTRATIONS_PER_DAY) return fail("temporarily_unavailable", "Trop d’enregistrements aujourd’hui.");

  const clientId = `mcp_${newSecret(18)}`;
  const confidential = parsed.data.token_endpoint_auth_method !== "none";
  const secret = confidential ? newSecret() : null;
  const name = parsed.data.client_name || "Application MCP";
  await prisma.mcpClient.create({ data: { clientId, name, redirectUris: parsed.data.redirect_uris, secretHash: secret ? sha256(secret) : null } });
  return {
    client_id: clientId,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    client_id_issued_at: Math.floor(now.getTime() / 1000),
    client_name: name,
    redirect_uris: parsed.data.redirect_uris,
    token_endpoint_auth_method: parsed.data.token_endpoint_auth_method,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  };
}

export async function findClient(clientId: string) {
  const row = await prisma.mcpClient.findUnique({ where: { clientId } });
  if (!row) return null;
  const redirectUris = Array.isArray(row.redirectUris) ? row.redirectUris.filter((u): u is string => typeof u === "string") : [];
  return { ...row, redirectUris };
}

/** After Ben clicked "Autoriser": the one-time code sent back to the client. */
export async function issueCode(input: { clientId: string; redirectUri: string; codeChallenge: string }, now = new Date()): Promise<string> {
  const code = newSecret();
  await prisma.$transaction([
    prisma.mcpClient.update({ where: { clientId: input.clientId }, data: { authorizedAt: now } }),
    prisma.mcpToken.create({ data: { kind: "code", hash: sha256(code), clientId: input.clientId, expiresAt: new Date(now.getTime() + CODE_TTL_MS), codeChallenge: input.codeChallenge, redirectUri: input.redirectUri } }),
  ]);
  return code;
}

async function issueTokens(clientId: string, now: Date) {
  const access = newSecret();
  const refresh = newSecret();
  await prisma.mcpToken.createMany({
    data: [
      { kind: "access", hash: sha256(access), clientId, expiresAt: new Date(now.getTime() + ACCESS_TTL_MS) },
      { kind: "refresh", hash: sha256(refresh), clientId, expiresAt: new Date(now.getTime() + REFRESH_TTL_MS) },
    ],
  });
  return { access_token: access, token_type: "Bearer", expires_in: Math.floor(ACCESS_TTL_MS / 1000), refresh_token: refresh, scope: "admin" };
}

/** A confidential client must show its secret; a public one only its id. */
async function clientAllowed(clientId: string, presented: { id?: string; secret?: string }): Promise<boolean> {
  if (presented.id && presented.id !== clientId) return false;
  const client = await prisma.mcpClient.findUnique({ where: { clientId }, select: { secretHash: true, authorizedAt: true } });
  if (!client?.authorizedAt) return false;
  if (!client.secretHash) return true;
  return !!presented.secret && safeEquals(sha256(presented.secret), client.secretHash);
}

export async function exchangeCode(input: { code: string; verifier: string; redirectUri?: string; clientId?: string; secret?: string }, now = new Date()) {
  const row = await prisma.mcpToken.findUnique({ where: { hash: sha256(input.code) } });
  if (!row || row.kind !== "code" || row.usedAt || row.expiresAt <= now) return fail("invalid_grant", "Code inconnu, expiré ou déjà utilisé.");
  // Single use, whatever happens next.
  await prisma.mcpToken.update({ where: { id: row.id }, data: { usedAt: now } });
  if (!row.codeChallenge || !pkceMatches(input.verifier, row.codeChallenge)) return fail("invalid_grant", "Vérification PKCE échouée.");
  if (input.redirectUri && input.redirectUri !== row.redirectUri) return fail("invalid_grant", "Adresse de retour différente.");
  if (!(await clientAllowed(row.clientId, { id: input.clientId, secret: input.secret }))) return fail("invalid_client", "Application non reconnue.");
  await prisma.mcpToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 86_400_000) } } });
  return issueTokens(row.clientId, now);
}

export async function refreshTokens(input: { refreshToken: string; clientId?: string; secret?: string }, now = new Date()) {
  const row = await prisma.mcpToken.findUnique({ where: { hash: sha256(input.refreshToken) } });
  if (!row || row.kind !== "refresh" || row.expiresAt <= now) return fail("invalid_grant", "Jeton de renouvellement inconnu ou expiré.");
  if (row.usedAt) {
    // Reused: someone else holds a copy. Cut the client off.
    await prisma.mcpToken.deleteMany({ where: { clientId: row.clientId } });
    return fail("invalid_grant", "Jeton déjà utilisé : accès coupé, reconnectez l’application.");
  }
  if (!(await clientAllowed(row.clientId, { id: input.clientId, secret: input.secret }))) return fail("invalid_client", "Application non reconnue.");
  await prisma.mcpToken.update({ where: { id: row.id }, data: { usedAt: now } });
  return issueTokens(row.clientId, now);
}

/** The client behind a bearer token, or null. */
export async function verifyAccessToken(token: string, now = new Date()): Promise<{ clientId: string; name: string } | null> {
  if (!token || token.length > 256) return null;
  const row = await prisma.mcpToken.findUnique({ where: { hash: sha256(token) }, include: { client: { select: { name: true, authorizedAt: true, lastUsedAt: true } } } });
  if (!row || row.kind !== "access" || row.expiresAt <= now || !row.client.authorizedAt) return null;
  if (!row.client.lastUsedAt || now.getTime() - row.client.lastUsedAt.getTime() > 5 * 60_000) {
    await prisma.mcpClient.update({ where: { clientId: row.clientId }, data: { lastUsedAt: now } }).catch(() => undefined);
  }
  return { clientId: row.clientId, name: row.client.name };
}

/** "Déconnecter" on /admin/mcp: the client and all its tokens go. */
export async function revokeClient(clientId: string): Promise<void> {
  await prisma.mcpClient.deleteMany({ where: { clientId } });
}
