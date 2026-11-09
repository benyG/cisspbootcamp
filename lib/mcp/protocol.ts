import { z } from "zod/v4";

/**
 * The MCP plug's protocol (docs/MCP.md): JSON-RPC over Streamable HTTP,
 * stateless, tools only, JSON answers (no event stream). Written by hand
 * rather than with the SDK: four methods, and the SDK brings Express and
 * Hono with it.
 */

export const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"] as const;
export const LATEST_VERSION = SUPPORTED_VERSIONS[0];

export type ToolContext = { clientId: string; clientName: string; now: Date };

export type ToolLevel = "read" | "write" | "request";

export type ToolDef<S extends z.ZodType = z.ZodType> = {
  name: string;
  title: string;
  description: string;
  level: ToolLevel;
  input: S;
  run: (args: z.output<S>, ctx: ToolContext) => Promise<unknown>;
};

export const defineTool = <S extends z.ZodType>(def: ToolDef<S>): ToolDef => def as unknown as ToolDef;

/** A problem worth telling Claude in plain words (unknown lead, bad dates…). */
export class ToolError extends Error {}

type RpcId = string | number | null;
type RpcResponse = { jsonrpc: "2.0"; id: RpcId; result?: unknown; error?: { code: number; message: string } };

const ok = (id: RpcId, result: unknown): RpcResponse => ({ jsonrpc: "2.0", id, result });
const err = (id: RpcId, code: number, message: string): RpcResponse => ({ jsonrpc: "2.0", id, error: { code, message } });

const INSTRUCTIONS = [
  "Application de vente et de pilotage des bootcamps CISSP, CC et Bâtisseur IA (www.cisspbootcamp.online).",
  "Commencez par pilot_overview et action_queue pour situer la journée. Montants en USD sauf mention contraire. Dates en UTC (ISO 8601).",
  "Les données de prospects sont personnelles : ne les recopiez nulle part ailleurs que dans la conversation.",
].join(" ");

export function toolListing(tools: readonly ToolDef[]) {
  return tools.map((t) => {
    const inputSchema = z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown>;
    delete inputSchema.$schema;
    return {
      name: t.name,
      title: t.title,
      description: t.description,
      inputSchema: { type: "object", ...inputSchema },
      annotations: { title: t.title, readOnlyHint: t.level === "read", destructiveHint: false, openWorldHint: false },
    };
  });
}

/** JSON with dates kept readable and no undefined noise. */
export const toText = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 1);

/**
 * One JSON-RPC message in, one answer out (null for a notification).
 * `onCall` is told about every tool call, for the journal.
 */
export async function handleMessage(
  message: unknown,
  ctx: ToolContext,
  tools: readonly ToolDef[],
  onCall?: (tool: string, ok: boolean) => Promise<void> | void,
): Promise<RpcResponse | null> {
  if (!message || typeof message !== "object" || Array.isArray(message)) return err(null, -32600, "Invalid Request");
  const msg = message as { jsonrpc?: unknown; id?: RpcId; method?: unknown; params?: Record<string, unknown> };
  if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return err(msg.id ?? null, -32600, "Invalid Request");
  const isNotification = !("id" in msg) || msg.id === undefined;
  if (isNotification) return null;
  const id = msg.id as RpcId;

  switch (msg.method) {
    case "initialize": {
      const asked = typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : "";
      const protocolVersion = (SUPPORTED_VERSIONS as readonly string[]).includes(asked) ? asked : LATEST_VERSION;
      return ok(id, { protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "cisspbootcamp", title: "CISSP Bootcamp — admin", version: "1.0.0" }, instructions: INSTRUCTIONS });
    }
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: toolListing(tools) });
    case "tools/call": {
      const name = msg.params?.name;
      const tool = tools.find((t) => t.name === name);
      if (!tool) return err(id, -32602, `Outil inconnu : ${String(name)}`);
      const parsed = tool.input.safeParse(msg.params?.arguments ?? {});
      if (!parsed.success) {
        return ok(id, { content: [{ type: "text", text: `Paramètres invalides : ${parsed.error.issues.map((i) => `${i.path.join(".") || "(racine)"} ${i.message}`).join(" ; ")}` }], isError: true });
      }
      try {
        const result = await tool.run(parsed.data, ctx);
        await onCall?.(tool.name, true);
        return ok(id, { content: [{ type: "text", text: toText(result) }] });
      } catch (error) {
        await onCall?.(tool.name, false);
        if (!(error instanceof ToolError)) console.error(`[mcp] ${tool.name}`, error);
        const text = error instanceof ToolError ? error.message : "L’outil a échoué côté serveur. Réessayez ; si cela persiste, regardez Admin › Santé des intégrations.";
        return ok(id, { content: [{ type: "text", text }], isError: true });
      }
    }
    default:
      return err(id, -32601, `Méthode non prise en charge : ${msg.method}`);
  }
}
