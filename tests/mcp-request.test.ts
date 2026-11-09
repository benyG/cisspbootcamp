import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  registration: { findUnique: vi.fn(async () => null as unknown) },
  lead: { findUnique: vi.fn(async () => null as unknown) },
  cohort: { findUnique: vi.fn(async () => null as unknown) },
  mcpRequest: {
    create: vi.fn(async () => ({ id: 12, expiresAt: new Date("2026-11-16T10:00:00Z") })),
    updateMany: vi.fn(async () => ({ count: 1 })),
    findUnique: vi.fn(async () => null as unknown),
    update: vi.fn(async () => ({})),
  },
  actionLog: { create: vi.fn(async () => ({})) },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const reg = vi.hoisted(() => ({ markRegistrationPaid: vi.fn(async () => ({ ok: true })), markBalancePaid: vi.fn(), registerByAdmin: vi.fn() }));
vi.mock("@/lib/registration", () => reg);
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));

import { ALL_TOOLS, REQUEST_TOOLS } from "@/lib/mcp/catalog";
import { handleMessage, toolListing } from "@/lib/mcp/protocol";
import { decideRequest } from "@/lib/mcp/requests";

const now = new Date("2026-11-09T10:00:00Z");
const ctx = { clientId: "mcp_x", clientName: "Claude", now };
const call = async (name: string, args: object) => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, ctx, REQUEST_TOOLS);
  const r = res?.result as { content: Array<{ text: string }>; isError?: boolean };
  return { error: !!r.isError, text: r.content[0]!.text };
};
const registration = { id: 7, leadId: 3, reference: "CB-7", status: "pending_manual", amountUsd: 45_000, balanceUsd: 0, balancePaidAt: null, lead: { firstName: "Awa", lastName: "K." }, cohort: { program: "cissp", name: "Janvier" } };

describe("MCP requests (lot 3)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("the catalogue has 38 tools with unique names and object schemas", () => {
    expect(ALL_TOOLS.length).toBe(38);
    expect(new Set(ALL_TOOLS.map((t) => t.name)).size).toBe(38);
    for (const t of toolListing(REQUEST_TOOLS)) expect(t.inputSchema.type).toBe("object");
  });

  it("a payment request is only prepared: summary stored, nothing paid", async () => {
    db.registration.findUnique.mockResolvedValueOnce(registration);
    const r = await call("request_payment_confirmation", { target: "registration", id: 7, note: "virement 123" });
    expect(r.error).toBe(false);
    expect(JSON.parse(r.text)).toMatchObject({ demande: 12, statut: "en attente de validation par Ben" });
    const saved = (db.mcpRequest.create.mock.calls[0] as unknown as [{ data: { kind: string; summary: string; payload: object } }])[0].data;
    expect(saved.kind).toBe("payment");
    expect(saved.summary).toContain("Awa K. · CISSP");
    expect(saved.summary).toContain("450 USD");
    expect(saved.payload).toEqual({ target: "registration", id: 7, note: "virement 123" });
    expect(reg.markRegistrationPaid).not.toHaveBeenCalled();
  });

  it("refuses to prepare what cannot happen", async () => {
    db.registration.findUnique.mockResolvedValueOnce({ ...registration, status: "paid" });
    expect((await call("request_payment_confirmation", { target: "registration", id: 7 })).text).toBe("Cette inscription est déjà payée.");
    db.lead.findUnique.mockResolvedValueOnce({ id: 3, firstName: "Awa", lastName: "K.", email: "a@x.test", consentAt: null, unsubscribedAt: null });
    expect((await call("request_email", { type: "followup", leadId: 3, subject: "Votre place", text: "Bonjour Awa, voici la suite de notre échange." })).text).toContain("pas accepté");
    db.cohort.findUnique.mockResolvedValueOnce({ id: 5, program: "cc", name: "Mars", _count: { registrations: 2 } });
    expect((await call("request_deletion", { target: "cohort", id: 5 })).text).toContain("moveToCohortId");
    expect(db.mcpRequest.create).not.toHaveBeenCalled();
  });

  it("Ben's click runs it once, through the shared code", async () => {
    db.mcpRequest.findUnique.mockResolvedValueOnce({ kind: "payment", payload: { target: "registration", id: 7 } });
    db.registration.findUnique.mockResolvedValueOnce(registration);
    const out = await decideRequest(12, true, now);
    expect(out).toEqual({ ok: true, message: "Paiement confirmé (CB-7)." });
    expect(db.mcpRequest.updateMany).toHaveBeenCalledWith({ where: { id: 12, status: "pending", expiresAt: { gt: now } }, data: { status: "running", decidedAt: now } });
    expect(reg.markRegistrationPaid).toHaveBeenCalledTimes(1);
    expect(db.mcpRequest.update).toHaveBeenCalledWith({ where: { id: 12 }, data: { status: "done", result: "Paiement confirmé (CB-7)." } });
  });

  it("a second click, a refusal or a lapsed request runs nothing", async () => {
    db.mcpRequest.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(await decideRequest(12, true, now)).toEqual({ ok: false, error: "Demande déjà traitée ou expirée." });
    expect(await decideRequest(12, false, now)).toEqual({ ok: true, message: "Demande refusée : rien n’a été fait." });
    expect(reg.markRegistrationPaid).not.toHaveBeenCalled();
    expect(db.mcpRequest.findUnique).not.toHaveBeenCalled();
  });

  it("a failure is stored as such", async () => {
    db.mcpRequest.findUnique.mockResolvedValueOnce({ kind: "payment", payload: { target: "registration", id: 7 } });
    db.registration.findUnique.mockRejectedValueOnce(new Error("db down"));
    const out = await decideRequest(12, true, now);
    expect(out.ok).toBe(false);
    expect(db.mcpRequest.update).toHaveBeenCalledWith({ where: { id: 12 }, data: { status: "failed", result: "L’action a échoué côté serveur." } });
  });
});

describe("MCP requests keep what Ben read", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a LinkedIn post edited after the request is not published", async () => {
    const { sha256 } = await import("@/lib/mcp/oauth");
    db.mcpRequest.findUnique.mockResolvedValueOnce({ kind: "linkedin", payload: { postId: 4, textSha: sha256("Texte relu par Ben") } });
    (db as unknown as { marketingPost: unknown }).marketingPost = { findUnique: vi.fn(async () => ({ text: "Texte changé ensuite" })) };
    const out = await decideRequest(12, true, now);
    expect(out.ok).toBe(false);
    expect(db.mcpRequest.update).toHaveBeenCalledWith({ where: { id: 12 }, data: { status: "failed", result: expect.stringContaining("Le post a changé") } });
  });
});
