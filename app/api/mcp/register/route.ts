import { json, preflight } from "@/lib/mcp/http";
import { registerClient } from "@/lib/mcp/oauth-server";

/** OAuth dynamic client registration (RFC 7591) for the MCP plug. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const out = await registerClient(body);
  return "error" in out ? json(out, 400) : json(out, 201);
}

export const OPTIONS = preflight;
