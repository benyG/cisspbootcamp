import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod/v4";

const db = vi.hoisted(() => ({
  mcpClient: { count: vi.fn(async () => 0), create: vi.fn(async () => ({})), findUnique: vi.fn(async () => null as unknown), update: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({})) },
  mcpToken: { findUnique: vi.fn(async () => null as unknown), update: vi.fn(async () => ({})), createMany: vi.fn(async () => ({})), deleteMany: vi.fn(async () => ({})), create: vi.fn(async () => ({})) },
  $transaction: vi.fn(async () => []),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { authorizationServerMetadata, basicCredentials, pkceMatches, protectedResourceMetadata, redirectUriAllowed, redirectWith, sha256 } from "@/lib/mcp/oauth";
import { exchangeCode, refreshTokens, registerClient, verifyAccessToken } from "@/lib/mcp/oauth-server";
import { LATEST_VERSION, ToolError, defineTool, handleMessage } from "@/lib/mcp/protocol";

const verifier = "a".repeat(43) + "-._~xyz";
const challenge = createHash("sha256").update(verifier).digest("base64url");
const now = new Date("2026-11-09T10:00:00Z");
const later = new Date(now.getTime() + 60_000);

describe("MCP OAuth rules", () => {
  it("checks PKCE S256", () => {
    expect(pkceMatches(verifier, challenge)).toBe(true);
    expect(pkceMatches(verifier + "x", challenge)).toBe(false);
    expect(pkceMatches("short", challenge)).toBe(false);
  });

  it("accepts https redirects, and http only back to this machine", () => {
    expect(redirectUriAllowed("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(redirectUriAllowed("http://localhost:6274/callback")).toBe(true);
    expect(redirectUriAllowed("http://127.0.0.1:33418/")).toBe(true);
    expect(redirectUriAllowed("http://evil.example/cb")).toBe(false);
    expect(redirectUriAllowed("javascript:alert(1)")).toBe(false);
    expect(redirectUriAllowed("https://claude.ai/cb#frag")).toBe(false);
  });

  it("publishes both metadata documents from the site URL", () => {
    const as = authorizationServerMetadata("https://www.cisspbootcamp.online/");
    expect(as.issuer).toBe("https://www.cisspbootcamp.online");
    expect(as.authorization_endpoint).toBe("https://www.cisspbootcamp.online/admin/mcp/autoriser");
    expect(as.code_challenge_methods_supported).toEqual(["S256"]);
    expect(protectedResourceMetadata("https://www.cisspbootcamp.online")).toMatchObject({ resource: "https://www.cisspbootcamp.online/api/mcp", authorization_servers: ["https://www.cisspbootcamp.online"] });
  });

  it("reads Basic credentials and builds the redirect back", () => {
    expect(basicCredentials(`Basic ${Buffer.from("id:se:cret").toString("base64")}`)).toEqual({ id: "id", secret: "se:cret" });
    expect(basicCredentials("Bearer x")).toBeNull();
    expect(redirectWith("https://claude.ai/cb?x=1", { code: "c", state: "s", iss: undefined })).toBe("https://claude.ai/cb?x=1&code=c&state=s");
  });
});

describe("MCP OAuth storage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers a public client and refuses a foreign http redirect", async () => {
    const out = await registerClient({ redirect_uris: ["https://claude.ai/api/mcp/auth_callback"], client_name: "Claude" }, now);
    expect(out).toMatchObject({ client_name: "Claude", token_endpoint_auth_method: "none" });
    expect("client_secret" in out).toBe(false);
    expect(await registerClient({ redirect_uris: ["http://evil.example/cb"] }, now)).toMatchObject({ error: "invalid_redirect_uri" });
    db.mcpClient.count.mockResolvedValueOnce(30);
    expect(await registerClient({ redirect_uris: ["https://claude.ai/cb"] }, now)).toMatchObject({ error: "temporarily_unavailable" });
  });

  const code = { id: 1, kind: "code", clientId: "mcp_x", usedAt: null, expiresAt: later, codeChallenge: challenge, redirectUri: "https://claude.ai/cb" };

  it("trades a code once, with the right verifier, for tokens", async () => {
    db.mcpToken.findUnique.mockResolvedValueOnce(code);
    db.mcpClient.findUnique.mockResolvedValueOnce({ secretHash: null, authorizedAt: now });
    const out = await exchangeCode({ code: "c", verifier, redirectUri: "https://claude.ai/cb", clientId: "mcp_x" }, now);
    expect(out).toMatchObject({ token_type: "Bearer", expires_in: 3600 });
    expect(db.mcpToken.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { usedAt: now } });

    db.mcpToken.findUnique.mockResolvedValueOnce({ ...code, usedAt: now });
    expect(await exchangeCode({ code: "c", verifier }, now)).toMatchObject({ error: "invalid_grant" });
    db.mcpToken.findUnique.mockResolvedValueOnce(code);
    expect(await exchangeCode({ code: "c", verifier: "b".repeat(43) }, now)).toMatchObject({ error: "invalid_grant" });
  });

  it("checks a confidential client's secret", async () => {
    db.mcpToken.findUnique.mockResolvedValueOnce(code);
    db.mcpClient.findUnique.mockResolvedValueOnce({ secretHash: sha256("right"), authorizedAt: now });
    expect(await exchangeCode({ code: "c", verifier, secret: "wrong" }, now)).toMatchObject({ error: "invalid_client" });
  });

  it("cuts the client off when a refresh token is used twice", async () => {
    db.mcpToken.findUnique.mockResolvedValueOnce({ id: 2, kind: "refresh", clientId: "mcp_x", usedAt: now, expiresAt: later });
    expect(await refreshTokens({ refreshToken: "r" }, now)).toMatchObject({ error: "invalid_grant" });
    expect(db.mcpToken.deleteMany).toHaveBeenCalledWith({ where: { clientId: "mcp_x" } });
  });

  it("accepts only live access tokens of authorised clients", async () => {
    db.mcpToken.findUnique.mockResolvedValueOnce({ kind: "access", clientId: "mcp_x", expiresAt: later, client: { name: "Claude", authorizedAt: now, lastUsedAt: now } });
    expect(await verifyAccessToken("t", now)).toEqual({ clientId: "mcp_x", name: "Claude" });
    db.mcpToken.findUnique.mockResolvedValueOnce({ kind: "access", clientId: "mcp_x", expiresAt: now, client: { name: "Claude", authorizedAt: now, lastUsedAt: now } });
    expect(await verifyAccessToken("t", now)).toBeNull();
    db.mcpToken.findUnique.mockResolvedValueOnce({ kind: "refresh", clientId: "mcp_x", expiresAt: later, client: { name: "Claude", authorizedAt: now, lastUsedAt: now } });
    expect(await verifyAccessToken("t", now)).toBeNull();
  });
});

describe("MCP protocol", () => {
  const ctx = { clientId: "mcp_x", clientName: "Claude", now };
  const echo = defineTool({ name: "echo", title: "Écho", description: "Renvoie n.", level: "read", input: z.object({ n: z.number().int().max(5) }), run: async ({ n }) => ({ n }) });
  const broken = defineTool({ name: "broken", title: "Cassé", description: "Échoue.", level: "read", input: z.object({}), run: async () => { throw new ToolError("Aucun prospect n°9."); } });
  const tools = [echo, broken];
  const rpc = (method: string, params?: object, id: number | null = 1) => ({ jsonrpc: "2.0", ...(id === null ? {} : { id }), method, ...(params ? { params } : {}) });

  it("negotiates the protocol version and says it has tools", async () => {
    const res = await handleMessage(rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } }), ctx, tools);
    expect(res?.result).toMatchObject({ protocolVersion: "2025-06-18", capabilities: { tools: {} }, serverInfo: { name: "cisspbootcamp" } });
    const other = await handleMessage(rpc("initialize", { protocolVersion: "1999-01-01" }), ctx, tools);
    expect((other?.result as { protocolVersion: string }).protocolVersion).toBe(LATEST_VERSION);
  });

  it("answers nothing to a notification", async () => {
    expect(await handleMessage(rpc("notifications/initialized", undefined, null), ctx, tools)).toBeNull();
  });

  it("lists tools with a JSON schema", async () => {
    const res = await handleMessage(rpc("tools/list"), ctx, tools);
    const listed = (res?.result as { tools: Array<{ name: string; inputSchema: { type: string; properties: object }; annotations: { readOnlyHint: boolean } }> }).tools;
    expect(listed.map((t) => t.name)).toEqual(["echo", "broken"]);
    expect(listed[0]!.inputSchema).toMatchObject({ type: "object", properties: { n: { type: "integer", maximum: 5 } } });
    expect(listed[0]!.annotations.readOnlyHint).toBe(true);
  });

  it("runs a tool, journals it, and reports bad input or a known problem as a tool error", async () => {
    const onCall = vi.fn();
    const res = await handleMessage(rpc("tools/call", { name: "echo", arguments: { n: 3 } }), ctx, tools, onCall);
    expect(res?.result).toEqual({ content: [{ type: "text", text: JSON.stringify({ n: 3 }, null, 1) }] });
    expect(onCall).toHaveBeenCalledWith("echo", true);

    const bad = await handleMessage(rpc("tools/call", { name: "echo", arguments: { n: 9 } }), ctx, tools, onCall);
    expect(bad?.result).toMatchObject({ isError: true });
    const known = await handleMessage(rpc("tools/call", { name: "broken", arguments: {} }), ctx, tools, onCall);
    expect(known?.result).toEqual({ content: [{ type: "text", text: "Aucun prospect n°9." }], isError: true });
    expect(onCall).toHaveBeenLastCalledWith("broken", false);
  });

  it("rejects unknown tools and methods", async () => {
    expect((await handleMessage(rpc("tools/call", { name: "nope" }), ctx, tools))?.error?.code).toBe(-32602);
    expect((await handleMessage(rpc("resources/list"), ctx, tools))?.error?.code).toBe(-32601);
    expect((await handleMessage([rpc("ping")], ctx, tools))?.error?.code).toBe(-32600);
  });
});

describe("MCP tool catalogue", () => {
  it("lot 1 is read-only and every tool has a schema", async () => {
    const { MCP_TOOLS } = await import("@/lib/mcp/tools");
    const { toolListing } = await import("@/lib/mcp/protocol");
    expect(MCP_TOOLS.length).toBe(13);
    expect(MCP_TOOLS.every((t) => t.level === "read")).toBe(true);
    expect(new Set(MCP_TOOLS.map((t) => t.name)).size).toBe(MCP_TOOLS.length);
    for (const t of toolListing(MCP_TOOLS)) expect(t.inputSchema.type).toBe("object");
  });
});
