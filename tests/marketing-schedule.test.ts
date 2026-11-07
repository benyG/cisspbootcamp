import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  marketingPost: { findMany: vi.fn<(a?: unknown) => Promise<unknown[]>>(async () => []), update: vi.fn(async () => ({})), count: vi.fn(async () => 0), findFirst: vi.fn(async () => null as unknown), create: vi.fn(async () => ({})) },
  marketingImage: { findFirst: vi.fn(async () => null as unknown) },
  cohort: { findMany: vi.fn<(a?: unknown) => Promise<unknown[]>>(async () => []) },
  siteSetting: { findUnique: vi.fn(async () => null as unknown) },
  actionLog: { create: vi.fn(async () => ({})) },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const li = vi.hoisted(() => ({ publishOnLinkedin: vi.fn(async () => ({ urn: "urn:li:share:1", url: "https://linkedin.test/1" })) }));
vi.mock("@/lib/linkedin", () => li);
vi.mock("@/lib/minimax", () => ({ readBytes: vi.fn(async () => new Uint8Array([1])) }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn<(i: { to: string; subject: string; text: string }) => Promise<{ sent: boolean; id: null }>>(async () => ({ sent: true, id: null })) }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test", ADMIN_EMAIL: "ben@x.test" } }));
const rhythm = vi.hoisted(() => ({ generateRhythmDrafts: vi.fn(async () => ({ ok: true as const, count: 3, topic: "Le temps perdu dans WhatsApp" })), RHYTHM_EVERY_DAYS: 6, RHYTHM_POSTS_PER_WEEK: 3 }));
vi.mock("@/lib/marketing/rhythm", () => rhythm);

import { isDue, publishDuePosts, scheduleDay } from "@/lib/marketing/schedule";
import { planContent, runContent } from "@/lib/playbooks/content";

const now = new Date("2026-11-12T05:30:00Z");
const post = (over: Record<string, unknown> = {}) => ({ id: 4, cohortId: 3, text: "Mini-cas : le budget sécurité\n\nhttps://x.test/?utm_content=li-abc123", scheduledFor: new Date("2026-11-12T00:00:00Z"), scheduledImageId: null, publishedAt: null, linkedinUrn: null, publishError: null, ...over });

describe("planned LinkedIn publication (lot 7)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts today or a later day, never a past one", () => {
    expect(scheduleDay("2026-11-12", now)?.toISOString()).toBe("2026-11-12T00:00:00.000Z");
    expect(scheduleDay("2026-11-11", now)).toBeNull();
    expect(scheduleDay("12/11/2026", now)).toBeNull();
    expect(isDue(post(), now)).toBe(true);
    expect(isDue(post({ scheduledFor: new Date("2026-11-13T00:00:00Z") }), now)).toBe(false);
    expect(isDue(post({ publishError: "refus" }), now)).toBe(false);
  });

  it("publishes the posts whose day has come, with their image", async () => {
    db.marketingPost.findMany.mockResolvedValue([post({ scheduledImageId: 9 })]);
    db.marketingImage.findFirst.mockResolvedValue({ id: 9, postId: 4, imagePathname: "x.png", headline: "Budget" });
    expect(await publishDuePosts(now)).toBe(1);
    expect(li.publishOnLinkedin).toHaveBeenCalledWith(expect.objectContaining({ image: expect.objectContaining({ alt: "Budget" }) }));
    expect(db.marketingPost.update).toHaveBeenCalledWith({ where: { id: 4 }, data: expect.objectContaining({ linkedinUrn: "urn:li:share:1", autoDraft: false }) });
  });

  it("keeps a refusal on the post and tells Ben once", async () => {
    db.marketingPost.findMany.mockResolvedValue([post()]);
    li.publishOnLinkedin.mockRejectedValueOnce(new Error("Jeton LinkedIn expiré"));
    expect(await publishDuePosts(now)).toBe(0);
    expect(db.marketingPost.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { publishError: "Jeton LinkedIn expiré" } });
    expect(mail.sendEmail.mock.calls[0]![0].text).toContain("https://x.test/admin/marketing?cohorte=3");
  });
});

describe("content rhythm playbook (lot 7)", () => {
  const cohort = (over: Record<string, unknown> = {}) => ({ id: 3, program: "cissp", name: "Cohorte de décembre", startsAt: new Date("2026-12-14T00:00:00Z"), capacity: 10, targetSeats: null, campaign: { channels: { linkedin: true } }, registrations: [], ...over });
  beforeEach(() => { vi.clearAllMocks(); db.marketingPost.count.mockResolvedValue(1); db.marketingPost.findFirst.mockResolvedValue(null); });

  it("plans drafts for a cohort in campaign on LinkedIn with fewer than 3 posts this week", async () => {
    db.cohort.findMany.mockResolvedValue([cohort(), cohort({ id: 4, campaign: { channels: { linkedin: false } } }), cohort({ id: 5, startsAt: new Date("2027-04-01T00:00:00Z") })]);
    const steps = await planContent(now);
    expect(steps.map((s) => s.generate?.cohortId)).toEqual([3]);
    expect(steps[0]!.email.text).toContain("https://x.test/admin/marketing?cohorte=3");
  });

  it("waits a week between two series, and stops at 3 posts", async () => {
    db.cohort.findMany.mockResolvedValue([cohort()]);
    db.marketingPost.findFirst.mockResolvedValue({ createdAt: new Date(now.getTime() - 2 * 86_400_000) });
    expect(await planContent(now)).toEqual([]);
    db.marketingPost.findFirst.mockResolvedValue(null);
    db.marketingPost.count.mockResolvedValue(3);
    expect(await planContent(now)).toEqual([]);
  });

  it("generates only when on: trial calls no AI", async () => {
    db.cohort.findMany.mockResolvedValue([cohort()]);
    expect(await runContent(now)).toBe("trial");
    expect(rhythm.generateRhythmDrafts).not.toHaveBeenCalled();
    expect(await runContent(now, "on")).toBe("done");
    expect(rhythm.generateRhythmDrafts).toHaveBeenCalledWith(3, now);
    expect(db.actionLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "playbook_content", payload: expect.objectContaining({ cohortId: 3, drafts: 3 }) }) });
  });
});
