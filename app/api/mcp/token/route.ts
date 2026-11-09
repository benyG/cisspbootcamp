import { json, preflight } from "@/lib/mcp/http";
import { basicCredentials, tokenSchema } from "@/lib/mcp/oauth";
import { exchangeCode, refreshTokens } from "@/lib/mcp/oauth-server";

/** OAuth token endpoint of the MCP plug: code (PKCE) or refresh token. */
export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const raw = type.includes("application/json")
    ? await request.json().catch(() => ({}))
    : Object.fromEntries(new URLSearchParams(await request.text()));
  const parsed = tokenSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "invalid_request", error_description: "Requête de jeton invalide." }, 400);

  const basic = basicCredentials(request.headers.get("authorization"));
  const client = { clientId: basic?.id ?? parsed.data.client_id, secret: basic?.secret ?? parsed.data.client_secret };
  const out = parsed.data.grant_type === "authorization_code"
    ? await exchangeCode({ code: parsed.data.code, verifier: parsed.data.code_verifier, redirectUri: parsed.data.redirect_uri, ...client })
    : await refreshTokens({ refreshToken: parsed.data.refresh_token, ...client });
  if ("error" in out) return json(out, out.error === "invalid_client" ? 401 : 400);
  return json(out);
}

export const OPTIONS = preflight;
