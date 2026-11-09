import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  lead: { findUnique: vi.fn(async () => null as unknown), update: vi.fn(async () => ({})) },
  registration: { count: vi.fn(async () => 0), findUnique: vi.fn(async () => null as unknown) },
  actionLog: { create: vi.fn(async () => ({})) },
  booking: { findUnique: vi.fn(async () => null as unknown), update: vi.fn(async () => ({})) },
  marketingPost: { findUnique: vi.fn(async () => null as unknown), update: vi.fn(async () => ({})), create: vi.fn(async () => ({ id: 77 })) },
  marketingImage: { findFirst: vi.fn(async () => null as unknown) },
  promoCode: { findUnique: vi.fn(async () => null as unknown), update: vi.fn(async () => ({})), create: vi.fn(async () => ({})) },
  cohort: { findUnique: vi.fn(async () => null as unknown), update: vi.fn(async () => ({})), create: vi.fn(async () => ({ id: 5 })) },
  analystReport: { findUnique: vi.fn(async () => null as unknown), update: vi.fn(async () => ({})) },
  seatHold: { findUnique: vi.fn(async () => null as unknown) },
  $transaction: vi.fn(async (ops: unknown) => ops),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const mail = vi.hoisted(() => ({ sendAfterCallEmail: vi.fn(async () => true) }));
vi.mock("@/lib/followups-auto", () => mail);
vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }));

import { WRITE_TOOLS } from "@/lib/mcp/tools-write";
import { handleMessage, toolListing } from "@/lib/mcp/protocol";

const now = new Date("2026-11-09T10:00:00Z");
const ctx = { clientId: "mcp_x", clientName: "Claude", now };
const call = async (name: string, args: object) => {
  const res = await handleMessage({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, ctx, WRITE_TOOLS);
  const r = res?.result as { content: Array<{ text: string }>; isError?: boolean };
  return { error: !!r.isError, text: r.content[0]!.text };
};

describe("MCP write tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("is lot 2: write level, object schemas without top-level unions", () => {
    expect(WRITE_TOOLS.length).toBe(15);
    expect(WRITE_TOOLS.every((t) => t.level === "write")).toBe(true);
    for (const t of toolListing(WRITE_TOOLS)) {
      expect(t.inputSchema.type).toBe("object");
      expect(t.inputSchema).not.toHaveProperty("oneOf");
      expect(t.annotations.readOnlyHint).toBe(false);
    }
  });

  it("update_lead adds a dated note and marks lost through the shared code", async () => {
    db.lead.findUnique.mockResolvedValue({ id: 3, notes: "Ancienne note" });
    const r = await call("update_lead", { leadId: 3, addNote: "Rappeler jeudi", status: "lost" });
    expect(r.error).toBe(false);
    expect(db.lead.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { notes: "Ancienne note\n[2026-11-09] Rappeler jeudi" } });
    expect(db.actionLog.create).toHaveBeenCalledWith({ data: { leadId: 3, type: "marked_lost" } });
  });

  it("update_lead refuses an empty change and an unknown lead", async () => {
    expect((await call("update_lead", { leadId: 3 })).error).toBe(true);
    db.lead.findUnique.mockResolvedValue(null);
    expect((await call("update_lead", { leadId: 9, addNote: "x" })).text).toBe("Aucun prospect n°9.");
  });

  it("update_lead never makes someone registered without a paid seat", async () => {
    db.lead.findUnique.mockResolvedValue({ id: 3 });
    const r = await call("update_lead", { leadId: 3, status: "registered" });
    expect(r.text).toContain("aucune place payée");
    expect(db.lead.update).toHaveBeenCalledWith({ where: { id: 3 }, data: {} });
  });

  it("record_call_outcome sends the after-call e-mail only where the admin does", async () => {
    db.booking.findUnique.mockResolvedValue({ id: 4, leadId: 3, kind: "discovery" });
    expect((await call("record_call_outcome", { bookingId: 4, outcome: "not_now" })).error).toBe(false);
    expect(mail.sendAfterCallEmail).not.toHaveBeenCalled();
    await call("record_call_outcome", { bookingId: 4, outcome: "to_follow_up" });
    expect(mail.sendAfterCallEmail).toHaveBeenCalledWith(3, "to_follow_up");
  });

  it("edit_post keeps the tracked link and leaves published posts alone", async () => {
    db.marketingPost.findUnique.mockResolvedValueOnce({ code: "li-abc123", publishedAt: null, linkedinUrn: null });
    expect((await call("edit_post", { postId: 1, text: "Nouveau texte sans le lien" })).text).toContain("li-abc123");
    db.marketingPost.findUnique.mockResolvedValueOnce({ code: "li-abc123", publishedAt: now, linkedinUrn: null });
    expect((await call("edit_post", { postId: 1, text: "Texte avec li-abc123 dedans" })).error).toBe(true);
    db.marketingPost.findUnique.mockResolvedValueOnce({ code: "li-abc123", publishedAt: null, linkedinUrn: null });
    expect((await call("edit_post", { postId: 1, text: "Texte avec li-abc123 dedans" })).error).toBe(false);
  });

  it("schedule_post refuses a past day and plans a LinkedIn post", async () => {
    expect((await call("schedule_post", { postId: 1, day: "2026-11-01" })).text).toBe("Date passée ou invalide.");
    db.marketingPost.findUnique.mockResolvedValueOnce({ channel: "linkedin", linkedinUrn: null, publishedAt: null });
    expect((await call("schedule_post", { postId: 1, day: "2026-11-12" })).error).toBe(false);
    expect(db.marketingPost.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { scheduledFor: new Date("2026-11-12T00:00:00Z"), scheduledImageId: null, publishError: null, autoDraft: false } });
  });

  it("promo_codes checks its fields and switches a code off", async () => {
    expect((await call("promo_codes", { action: "create_partner", code: "x", label: "P", percent: 10 })).error).toBe(true);
    db.promoCode.findUnique.mockResolvedValueOnce({ id: 2, code: "PARTNER10", active: true });
    expect((await call("promo_codes", { action: "deactivate", code: "partner10" })).text).toContain("désactivé");
    expect(db.promoCode.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { active: false } });
  });

  it("cohorts: a started cohort only changes its name", async () => {
    db.cohort.findUnique.mockResolvedValue({ id: 5, program: "cc", name: "Janvier", startsAt: new Date("2026-11-01T00:00:00Z"), endsAt: new Date("2026-12-01T00:00:00Z"), capacity: 10, targetSeats: null, status: "running", _count: { registrations: 4, sessions: 2 } });
    const r = await call("cohorts", { action: "update", cohortId: 5, name: "Janvier (soir)", capacity: 12 });
    expect(r.error).toBe(false);
    expect(db.cohort.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { name: "Janvier (soir)" } });
  });

  it("analyst decisions need a rank that exists", async () => {
    db.analystReport.findUnique.mockResolvedValue({ decisions: {}, output: { bets: [{}, {}] } });
    expect((await call("analyst", { action: "keep", week: "2026-11-09", rank: 3 })).text).toContain("2 orientations");
    expect((await call("analyst", { action: "keep", week: "2026-11-09", rank: 1 })).error).toBe(false);
    expect(db.analystReport.update).toHaveBeenCalledWith({ where: { weekKey: "2026-11-09" }, data: { decisions: { "1": { status: "kept", at: now.toISOString() } } } });
  });

  it("mark_followup_done asks for what it needs", async () => {
    expect((await call("mark_followup_done", { leadId: 3 })).error).toBe(true);
  });
});
