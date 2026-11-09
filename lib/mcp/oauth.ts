import { createHash, randomBytes } from "node:crypto";

import { z } from "zod";

/**
 * The OAuth 2.1 rules of the MCP plug (docs/MCP.md), pure. Claude registers
 * itself (dynamic client registration), sends Ben to the admin's Google
 * sign-in, then trades a one-time code (PKCE S256) for short tokens.
 */

export const CODE_TTL_MS = 10 * 60_000;
export const ACCESS_TTL_MS = 60 * 60_000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;
/** Self-registrations accepted per 24 h, so the table cannot be flooded. */
export const MAX_REGISTRATIONS_PER_DAY = 30;

export const newSecret = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/** PKCE S256: base64url(sha256(verifier)) must equal the challenge. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return createHash("sha256").update(verifier, "ascii").digest("base64url") === challenge;
}

/** https anywhere; http only back to the machine itself (Claude Code, MCP Inspector). */
export function redirectUriAllowed(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

export const registrationSchema = z.object({
  redirect_uris: z.array(z.string().max(512)).min(1).max(10),
  client_name: z.string().trim().max(120).optional(),
  token_endpoint_auth_method: z.enum(["none", "client_secret_post", "client_secret_basic"]).default("none"),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

export const authorizeSchema = z.object({
  response_type: z.literal("code"),
  client_id: z.string().min(1).max(64),
  redirect_uri: z.string().min(1).max(512),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  state: z.string().max(1024).optional(),
  scope: z.string().max(512).optional(),
  resource: z.string().max(512).optional(),
});
export type AuthorizeRequest = z.infer<typeof authorizeSchema>;

export const tokenSchema = z.discriminatedUnion("grant_type", [
  z.object({ grant_type: z.literal("authorization_code"), code: z.string().min(1).max(256), redirect_uri: z.string().max(512).optional(), code_verifier: z.string().min(1).max(256), client_id: z.string().max(64).optional(), client_secret: z.string().max(256).optional() }),
  z.object({ grant_type: z.literal("refresh_token"), refresh_token: z.string().min(1).max(256), client_id: z.string().max(64).optional(), client_secret: z.string().max(256).optional() }),
]);

/** The redirect back to the client, with its state when it sent one. */
export function redirectWith(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  return url.toString();
}

/** Client credentials from an HTTP Basic header, when the client uses one. */
export function basicCredentials(header: string | null): { id: string; secret: string } | null {
  if (!header?.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const i = decoded.indexOf(":");
  if (i < 0) return null;
  return { id: decodeURIComponent(decoded.slice(0, i)), secret: decodeURIComponent(decoded.slice(i + 1)) };
}

/** Where everything lives, from the public URL of the site. */
export function endpoints(appUrl: string) {
  const base = appUrl.replace(/\/+$/, "");
  return {
    issuer: base,
    resource: `${base}/api/mcp`,
    authorize: `${base}/admin/mcp/autoriser`,
    token: `${base}/api/mcp/token`,
    register: `${base}/api/mcp/register`,
    resourceMetadata: `${base}/.well-known/oauth-protected-resource`,
  };
}

export function authorizationServerMetadata(appUrl: string) {
  const e = endpoints(appUrl);
  return {
    issuer: e.issuer,
    authorization_endpoint: e.authorize,
    token_endpoint: e.token,
    registration_endpoint: e.register,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    scopes_supported: ["admin"],
  };
}

export function protectedResourceMetadata(appUrl: string) {
  const e = endpoints(appUrl);
  return { resource: e.resource, authorization_servers: [e.issuer], scopes_supported: ["admin"], bearer_methods_supported: ["header"], resource_name: "CISSP Bootcamp — admin" };
}
