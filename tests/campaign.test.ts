import { describe, expect, it } from "vitest";

import { DEFAULT_CAMPAIGN, buildCampaignPlan, campaignFromForm, dueActions, planCounts, readCampaign } from "@/lib/campaign";

const start = new Date("2027-02-08T00:00:00Z");
const end = new Date("2027-02-22T00:00:00Z");
const cohort = { program: "cissp", startsAt: start, endsAt: end, goal: 10 };
const form = (values: Record<string, string>) => (name: string) => values[name] ?? null;

describe("campaign settings", () => {
  it("reads the form's flat fields, and only keeps a launch price with a date", () => {
    const c = campaignFromForm(form({ chEmail: "on", chLinkedin: "on", chAds: "on", adsBudgetUsd: "300", promoEarly: "on", earlyPercent: "15", earlyUntil: "2027-01-08", promoReferral: "on" }));
    expect(c.channels).toEqual({ email: true, linkedin: true, facebook: false, whatsapp: false, ads: true });
    expect(c.adsBudgetUsd).toBe(300);
    expect(c.promo).toEqual({ early: { percent: 15, until: "2027-01-08" }, partners: false, referral: true });
    expect(campaignFromForm(form({ promoEarly: "on", earlyPercent: "15" })).promo.early).toBeNull();
  });

  it("treats a missing or broken campaign as none", () => {
    expect(readCampaign(null)).toBeNull();
    expect(readCampaign({ channels: { email: "yes" } })).toBeNull();
    expect(readCampaign({})).toEqual(DEFAULT_CAMPAIGN);
  });
});

describe("plan", () => {
  it("dates every action from J-60 to a week after the last day, in order", () => {
    const plan = buildCampaignPlan(cohort, DEFAULT_CAMPAIGN);
    expect(plan[0]!.key).toBe("opening");
    expect(plan[0]!.date.toISOString().slice(0, 10)).toBe("2026-12-10");
    expect(plan.find((a) => a.key === "close")!.day).toBe(-7);
    expect(plan.find((a) => a.key === "last-call")!.day).toBe(-11);
    expect(plan.at(-1)!.key).toBe("wrapup");
    expect(plan.at(-1)!.day).toBe(21);
    expect(plan.map((a) => a.day)).toEqual([...plan.map((a) => a.day)].sort((a, b) => a - b));
  });

  it("asks for weekly posts only with a social channel, and adds promo and ads actions when chosen", () => {
    const quiet = buildCampaignPlan(cohort, { ...DEFAULT_CAMPAIGN, channels: { ...DEFAULT_CAMPAIGN.channels, linkedin: false } });
    expect(quiet.some((a) => a.key.startsWith("posts"))).toBe(false);
    const full = buildCampaignPlan(cohort, { channels: { email: true, linkedin: true, facebook: true, whatsapp: true, ads: true }, adsBudgetUsd: 300, promo: { early: { percent: 15, until: "2027-01-08" }, partners: true, referral: true } });
    expect(full.filter((a) => a.key.startsWith("posts"))).toHaveLength(7); // J-56 to J-14, weekly, before the close
    expect(full.find((a) => a.key === "early-end")!.date.toISOString().slice(0, 10)).toBe("2027-01-08");
    expect(full.find((a) => a.key === "ads")!.text).toContain("300 USD");
    expect(full.find((a) => a.key === "content-plan")!.text).toContain("LinkedIn et Facebook");
    expect(planCounts(full).validate).toBeGreaterThan(planCounts(quiet).validate);
  });

  it("ends the Bâtisseur IA curve the day before its first day", () => {
    const plan = buildCampaignPlan({ ...cohort, program: "ia", goal: 12 }, DEFAULT_CAMPAIGN);
    expect(plan.find((a) => a.key === "close")!.day).toBe(-1);
    expect(plan.find((a) => a.key === "close")!.text).toContain("12 places");
  });

  it("puts in Ben's queue the due actions to validate, not done, for two weeks", () => {
    const plan = buildCampaignPlan(cohort, DEFAULT_CAMPAIGN);
    const at = (iso: string) => new Date(`${iso}T08:00:00Z`);
    expect(dueActions(plan, new Set(), at("2026-12-09"))).toEqual([]);
    expect(dueActions(plan, new Set(), at("2026-12-10")).map((a) => a.key)).toEqual(["content-plan"]);
    expect(dueActions(plan, new Set(["content-plan"]), at("2026-12-10"))).toEqual([]);
    expect(dueActions(plan, new Set(), at("2026-12-20")).map((a) => a.key)).toEqual(["content-plan", "posts-56"]);
    expect(dueActions(plan, new Set(), at("2027-01-01")).map((a) => a.key)).not.toContain("content-plan");
  });
});
