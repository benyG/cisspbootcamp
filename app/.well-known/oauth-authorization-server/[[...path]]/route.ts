import { env } from "@/lib/env";
import { json, preflight } from "@/lib/mcp/http";
import { authorizationServerMetadata } from "@/lib/mcp/oauth";

/** RFC 8414: the MCP plug's OAuth endpoints. */
export function GET() {
  return json(authorizationServerMetadata(env.NEXT_PUBLIC_APP_URL));
}

export const OPTIONS = preflight;
