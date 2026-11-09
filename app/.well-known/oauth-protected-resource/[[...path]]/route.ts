import { env } from "@/lib/env";
import { json, preflight } from "@/lib/mcp/http";
import { protectedResourceMetadata } from "@/lib/mcp/oauth";

/** RFC 9728: where the MCP plug's tokens come from (with or without the /api/mcp suffix). */
export function GET() {
  return json(protectedResourceMetadata(env.NEXT_PUBLIC_APP_URL));
}

export const OPTIONS = preflight;
