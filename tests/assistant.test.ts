import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_TURNS, MAX_TURNS_PER_IP_PER_DAY, buildKnowledge, capState, citedSources, hashIp, systemPrompt } from "@/lib/assistant";

const knowledgeInput = {
  appUrl: "https://www.cisspbootcamp.online/",
  iaUrl: "https://batisseur-ia.com/",
  cisspFaq: [{ q: "L’examen est-il inclus ?", a: "Non. Les frais d’examen se règlent auprès d’ISC²." }],
  iaFaq: [{ q: "Je ne sais pas coder.", a: "C’est prévu." }],
  programs: [{ code: "cissp", name: "CISSP Bootcamp", productLine: "40 h de préparation." }, { code: "ia", name: "Bâtisseur IA", productLine: "30 h." }],
  cohorts: [{ program: "cissp", name: "Janvier 2027", startsAt: new Date("2027-01-11T00:00:00Z"), remaining: 4, capacity: 10 }],
};

describe("knowledge", () => {
  const sources = buildKnowledge(knowledgeInput);
  it("numbers every piece with its page", () => {
    expect(sources[0]).toMatchObject({ id: "S1", title: "CISSP Bootcamp", url: "https://www.cisspbootcamp.online" });
    expect(sources.find((s) => s.title === "Bâtisseur IA")?.url).toBe("https://batisseur-ia.com");
    expect(sources.find((s) => s.title.startsWith("Prochaine cohorte CISSP"))?.text).toContain("4 place(s) restante(s) sur 10");
    expect(sources.find((s) => s.title === "Diagnostic Bâtisseur IA")?.url).toBe("https://batisseur-ia.com/diagnostic");
    expect(new Set(sources.map((s) => s.id)).size).toBe(sources.length);
  });
  it("tells the model to stay within the sources and never invent prices", () => {
    const prompt = systemPrompt(sources);
    expect(prompt).toContain("UNIQUEMENT");
    expect(prompt).toContain("Jamais de prix inventé");
    expect(prompt).toContain("[S1] CISSP Bootcamp");
  });
  it("keeps only real sources, once each, and hands over an unsourced answer", () => {
    expect(citedSources({ answer: "x", sources: ["S1", "s1", "S999"], escalate: false }, sources)).toEqual({ links: [{ title: "CISSP Bootcamp", url: "https://www.cisspbootcamp.online" }], escalate: false });
    expect(citedSources({ answer: "x", sources: [], escalate: false }, sources).escalate).toBe(true);
    expect(citedSources({ answer: "x", sources: ["S1"], escalate: true }, sources).escalate).toBe(true);
  });
});

describe("caps", () => {
  it("stops a conversation at 20 messages and an IP at its daily cap", () => {
    expect(capState(MAX_TURNS - 1, 0)).toBe("ok");
    expect(capState(MAX_TURNS, 0)).toBe("conversation");
    expect(capState(0, MAX_TURNS_PER_IP_PER_DAY)).toBe("day");
  });
  it("hashes the IP with a salt and the day", () => {
    expect(hashIp("1.2.3.4", "s", "2026-11-15")).toHaveLength(64);
    expect(hashIp("1.2.3.4", "s", "2026-11-15")).not.toBe(hashIp("1.2.3.4", "s", "2026-11-16"));
  });
});

// ── The server: guardrails, budget, caps, a sourced answer ──────────────────

const db = vi.hoisted(() => ({
  siteSetting: { findUnique: vi.fn(), findMany: vi.fn(async () => []) },
  assistantConversation: { findUnique: vi.fn(), aggregate: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  actionLog: { findMany: vi.fn(async () => []), create: vi.fn(), findFirst: vi.fn() },
  siteQuestion: { create: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn, revalidateTag: vi.fn() }));
vi.mock("@/lib/cohorts-admin", () => ({ publicCohortSummary: vi.fn(async () => null) }));
vi.mock("@/lib/messaging/email", () => ({ sendEmail: vi.fn(async () => ({ sent: true, id: null })) }));
const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error { status = 500; }
  class Anthropic { static APIError = APIError; messages = { create: ai.create }; }
  return { default: Anthropic };
});

import { askAssistant, handOverQuestion } from "@/lib/assistant-server";

const answer = (json: object) => ({ model: "claude-sonnet-5-5", stop_reason: "end_turn", usage: { input_tokens: 100, output_tokens: 50 }, content: [{ type: "text", text: JSON.stringify(json) }] });

describe("askAssistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.siteSetting.findUnique.mockResolvedValue(null);
    db.assistantConversation.findUnique.mockResolvedValue(null);
    db.assistantConversation.aggregate.mockResolvedValue({ _sum: { turns: 0 } });
    db.assistantConversation.create.mockResolvedValue({ id: "a".repeat(24), turns: 0, transcript: [] });
  });

  it("answers with its sources and keeps the transcript", async () => {
    ai.create.mockResolvedValue(answer({ answer: "Non, l’examen se règle auprès d’ISC².", sources: ["S1"], escalate: false }));
    const reply = await askAssistant({ conversationId: null, message: "L’examen est inclus ?", program: "cissp", ip: "1.2.3.4" });
    expect(reply).toMatchObject({ ok: true, handOver: false, remaining: MAX_TURNS - 1 });
    expect(reply.ok && reply.links.length).toBe(1);
    expect(db.assistantConversation.update.mock.calls[0]![0].data.transcript).toHaveLength(2);
    expect(ai.create.mock.calls[0]![0].model).toBe("claude-sonnet-5-5");
  });

  it("hands over when switched off, without calling the model", async () => {
    db.siteSetting.findUnique.mockResolvedValue({ value: { off: ["assistant"] } });
    expect(await askAssistant({ conversationId: null, message: "?", program: "cissp", ip: "1" })).toMatchObject({ ok: false, reason: "off" });
    db.siteSetting.findUnique.mockResolvedValue({ value: { stopped: true } });
    expect(await askAssistant({ conversationId: null, message: "?", program: "cissp", ip: "1" })).toMatchObject({ ok: false, reason: "off" });
    expect(ai.create).not.toHaveBeenCalled();
  });

  it("hands over past 20 messages, or over the AI budget", async () => {
    db.assistantConversation.findUnique.mockResolvedValue({ id: "b".repeat(24), turns: MAX_TURNS, transcript: [] });
    expect(await askAssistant({ conversationId: "b".repeat(24), message: "?", program: "cissp", ip: "1" })).toMatchObject({ ok: false, reason: "limit" });
    db.assistantConversation.findUnique.mockResolvedValue(null);
    db.actionLog.findMany.mockResolvedValueOnce([{ payload: { feature: "studio", usd: 31 } }] as never);
    expect(await askAssistant({ conversationId: null, message: "?", program: "cissp", ip: "1" })).toMatchObject({ ok: false, reason: "budget" });
    expect(ai.create).not.toHaveBeenCalled();
  });

  it("hands over an unreadable or failed answer", async () => {
    ai.create.mockResolvedValue({ ...answer({}), content: [{ type: "text", text: "pas du JSON" }] });
    expect(await askAssistant({ conversationId: null, message: "?", program: "ia", ip: "1" })).toMatchObject({ ok: false, reason: "error", handOver: true });
  });

  it("records a handed-over question with its consent time", async () => {
    db.siteQuestion.create.mockResolvedValue({ id: 3 });
    await handOverQuestion({ conversationId: null, email: "awa@example.com", question: "Puis-je payer en trois fois ?" });
    expect(db.siteQuestion.create.mock.calls[0]![0].data.consentAt).toBeInstanceOf(Date);
  });
});
