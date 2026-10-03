import { decrypt, encrypt, loadKey } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

/**
 * Publishing marketing posts on Ben's LinkedIn profile (Ben, 03/10), over
 * plain fetch: OpenID sign-in for the member id, then the Posts API. Small
 * apps get no refresh token, so the token lasts 60 days and Ben reconnects.
 * The token is sealed with the same AES key as the Google one.
 */

const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const API = "https://api.linkedin.com";
const SCOPES = ["openid", "profile", "w_member_social"];

export const LINKEDIN_REDIRECT_PATH = "/api/linkedin/callback";
export const LINKEDIN_STATE_COOKIE = "linkedin_oauth_state";
/** The admin warns this many days before the token expires. */
export const EXPIRY_WARNING_DAYS = 7;
/** Images go through a server action: keep under the 4.5 MB request limit. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export function linkedinConfigured(): boolean {
  return Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
}

export function linkedinRedirectUri(): string {
  return `${env.NEXT_PUBLIC_APP_URL}${LINKEDIN_REDIRECT_PATH}`;
}

export function linkedinConsentUrl(state: string): string {
  const params = new URLSearchParams({ response_type: "code", client_id: env.LINKEDIN_CLIENT_ID, redirect_uri: linkedinRedirectUri(), state, scope: SCOPES.join(" ") });
  return `${AUTH_URL}?${params}`;
}

/** Code → token → member id and name, then stored sealed. */
export async function connectLinkedin(code: string): Promise<{ name: string }> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: linkedinRedirectUri(), client_id: env.LINKEDIN_CLIENT_ID, client_secret: env.LINKEDIN_CLIENT_SECRET }),
  });
  if (!response.ok) throw new Error(`Échange du code LinkedIn refusé (${response.status})`);
  const token = (await response.json()) as { access_token: string; expires_in: number };

  const me = await fetch(`${API}/v2/userinfo`, { headers: { Authorization: `Bearer ${token.access_token}` } });
  if (!me.ok) throw new Error(`Profil LinkedIn illisible (${me.status}) : vérifiez le produit « Sign In with LinkedIn using OpenID Connect »`);
  const profile = (await me.json()) as { sub: string; name?: string; given_name?: string; family_name?: string };

  const name = profile.name ?? [profile.given_name, profile.family_name].filter(Boolean).join(" ");
  const sealed = encrypt(token.access_token, loadKey(env.GOOGLE_TOKEN_ENCRYPTION_KEY));
  const data = { memberUrn: `urn:li:person:${profile.sub}`, name: name.slice(0, 180), accessTokenSealed: sealed, expiresAt: new Date(Date.now() + token.expires_in * 1000), connectedAt: new Date() };
  await prisma.linkedinCredential.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
  return { name: data.name };
}

export type LinkedinStatus = { state: "not_configured" } | { state: "disconnected" } | { state: "expired"; name: string } | { state: "connected"; name: string; expiresAt: Date; expiresSoon: boolean };

export function statusOf(credential: { name: string; expiresAt: Date } | null, configured: boolean, now = new Date()): LinkedinStatus {
  if (!configured) return { state: "not_configured" };
  if (!credential) return { state: "disconnected" };
  if (credential.expiresAt <= now) return { state: "expired", name: credential.name };
  return { state: "connected", name: credential.name, expiresAt: credential.expiresAt, expiresSoon: credential.expiresAt.getTime() - now.getTime() < EXPIRY_WARNING_DAYS * 86_400_000 };
}

export async function linkedinStatus(now = new Date()): Promise<LinkedinStatus> {
  const credential = await prisma.linkedinCredential.findUnique({ where: { id: 1 }, select: { name: true, expiresAt: true } }).catch(() => null);
  return statusOf(credential, linkedinConfigured(), now);
}

/**
 * LinkedIn's "little text" format: these characters are markup and must be
 * escaped, or the post is cut or refused. Hashtags become real hashtags.
 */
export function toLittleText(text: string): string {
  const escape = (s: string) => s.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);
  const parts: string[] = [];
  let last = 0;
  for (const match of text.matchAll(/(^|\s)#([\p{L}\p{N}_]+)/gu)) {
    const start = (match.index ?? 0) + match[1].length;
    parts.push(escape(text.slice(last, start)), `{hashtag|\\#|${match[2]}}`);
    last = start + 1 + match[2].length;
  }
  parts.push(escape(text.slice(last)));
  return parts.join("");
}

function headers(token: string, json = true): Record<string, string> {
  return { Authorization: `Bearer ${token}`, "LinkedIn-Version": env.LINKEDIN_API_VERSION, "X-Restli-Protocol-Version": "2.0.0", ...(json ? { "Content-Type": "application/json" } : {}) };
}

async function failure(what: string, response: Response): Promise<Error> {
  const body = (await response.text()).slice(0, 300);
  if (response.status === 401) return new Error("LinkedIn a refusé le jeton : reconnectez LinkedIn dans Paramètres.");
  if (response.status === 426) return new Error(`Version d'API LinkedIn retirée (${env.LINKEDIN_API_VERSION}) : mettez à jour LINKEDIN_API_VERSION sur Vercel.`);
  return new Error(`${what} : LinkedIn a répondu ${response.status} ${body}`);
}

async function uploadImage(token: string, owner: string, image: { bytes: Uint8Array; type: string }): Promise<string> {
  const init = await fetch(`${API}/rest/images?action=initializeUpload`, { method: "POST", headers: headers(token), body: JSON.stringify({ initializeUploadRequest: { owner } }) });
  if (!init.ok) throw await failure("Préparation de l'image", init);
  const { value } = (await init.json()) as { value: { uploadUrl: string; image: string } };
  const put = await fetch(value.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": image.type }, body: image.bytes as BodyInit });
  if (!put.ok) throw await failure("Envoi de l'image", put);
  return value.image;
}

/** Publishes on Ben's profile; returns the post URN and its public URL. */
export async function publishOnLinkedin(input: { text: string; image?: { bytes: Uint8Array; type: string; alt: string } | null }): Promise<{ urn: string; url: string }> {
  const credential = await prisma.linkedinCredential.findUnique({ where: { id: 1 } });
  if (!credential || credential.expiresAt <= new Date()) throw new Error("LinkedIn n'est pas connecté ou la connexion a expiré : Paramètres › LinkedIn.");
  const token = decrypt(credential.accessTokenSealed, loadKey(env.GOOGLE_TOKEN_ENCRYPTION_KEY));
  const imageUrn = input.image ? await uploadImage(token, credential.memberUrn, input.image) : null;
  const response = await fetch(`${API}/rest/posts`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      author: credential.memberUrn,
      commentary: toLittleText(input.text),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(imageUrn ? { content: { media: { id: imageUrn, altText: input.image?.alt.slice(0, 300) ?? "" } } } : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!response.ok) throw await failure("Publication", response);
  const urn = response.headers.get("x-restli-id") ?? "";
  return { urn, url: urn ? `https://www.linkedin.com/feed/update/${urn}/` : "https://www.linkedin.com/in/me/recent-activity/all/" };
}
