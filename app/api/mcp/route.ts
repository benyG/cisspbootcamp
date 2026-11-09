import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { CORS_HEADERS, json, preflight } from "@/lib/mcp/http";
import { endpoints } from "@/lib/mcp/oauth";
import { verifyAccessToken } from "@/lib/mcp/oauth-server";
import { handleMessage } from "@/lib/mcp/protocol";
import { MCP_TOOLS } from "@/lib/mcp/tools";

export const dynamic = "force-dynamic";
// health_check calls every outside service; the rest answers in a second or two.
export const maxDuration = 60;

/** Without a valid token: where to get one (RFC 9728), so Claude starts the OAuth dance. */
function unauthorized(expired: boolean): Response {
  const metadata = endpoints(env.NEXT_PUBLIC_APP_URL).resourceMetadata;
  // Header text stays ASCII; the body carries the French.
  const header = expired ? `Bearer resource_metadata="${metadata}", error="invalid_token", error_description="Token invalid or expired"` : `Bearer resource_metadata="${metadata}"`;
  return json({ error: "invalid_token", error_description: expired ? "Jeton invalide ou expiré" : "Connexion requise" }, 401, { "WWW-Authenticate": header });
}

/** The MCP plug (docs/MCP.md): Streamable HTTP, stateless, JSON answers. */
export async function POST(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const client = token ? await verifyAccessToken(token) : null;
  if (!client) return unauthorized(!!token);

  const message = await request.json().catch(() => undefined);
  if (message === undefined) return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);

  const response = await handleMessage(message, { clientId: client.clientId, clientName: client.name, now: new Date() }, MCP_TOOLS, (tool, ok) =>
    prisma.actionLog.create({ data: { type: "mcp_call", payload: { tool, ok, client: client.name, clientId: client.clientId } } }).then(() => undefined, () => undefined),
  );
  if (!response) return new Response(null, { status: 202, headers: CORS_HEADERS });
  return json(response);
}

/** No server-to-client stream: everything is answered in the POST. */
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS_HEADERS } });
}

export const DELETE = GET;
export const OPTIONS = preflight;
