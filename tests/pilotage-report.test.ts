import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  cohort: { findMany: vi.fn() },
  marketingPost: { findMany: vi.fn(async () => []) },
  siteSetting: { findUnique: vi.fn(), upsert: vi.fn(async () => ({})) },
  $queryRaw: vi.fn(async () => [] as unknown[]),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn<(input: { to: string; subject: string; text: string }) => Promise<{ sent: boolean; id: null; reason?: string }>>(async () => ({ sent: true, id: null })) }));
vi.mock("@/lib/messaging/email", () => mail);
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test", ADMIN_EMAIL: "ben@x.test" } }));

import { pilot } from "@/lib/pilotage";
import { mondayReport, reportWeekKey } from "@/lib/pilotage-report";
import { loadPilotCohorts, sendMondayReport, sourceLabel } from "@/lib/pilotage-server";

const DAY = 86_400_000;
const monday = new Date("2026-11-09T05:30:00Z");
const start = new Date("2026-12-14T00:00:00Z");
const at = (j: number) => new Date(start.getTime() + j * DAY + 12 * 3_600_000);

describe("Monday report text", () => {
  it("says where each cohort stands, last week's funnel and the best posts, without clock times", () => {
    const late = pilot({ program: "cissp", startsAt: start, goal: 10, paidAt: [at(-50), at(-45)] }, monday);
    const later = pilot({ program: "ia", startsAt: new Date("2027-01-23T00:00:00Z"), goal: 12, paidAt: [] }, monday);
    const { subject, text: raw } = mondayReport({
      now: monday,
      cohorts: [
        { title: "CISSP Bootcamp — Cohorte de décembre", startsAt: start, pilot: late, pendingRecent: 1, held: 1 },
        { title: "Bâtisseur IA — Entrée du 23 janvier", startsAt: new Date("2027-01-23T00:00:00Z"), pilot: later, pendingRecent: 0, held: 0 },
      ],
      week: [{ program: "CISSP Bootcamp", steps: [{ unit: "visites", count: 1240 }, { unit: "analyses de profil", count: 21 }] }, { program: "Bâtisseur IA", steps: [{ unit: "visites", count: 0 }] }],
      posts: [{ channel: "linkedin", topic: "Mini-cas : le budget sécurité", visitors: 31 }],
      appUrl: "https://x.test/",
    });
    // French number formatting uses a narrow no-break space (1 240).
    const text = raw.replace(/\u202f/g, " ");
    expect(subject).toBe("Pilotage du lundi 9 novembre : 1 cohorte en campagne, 1 en retard");
    expect(text).toContain("• CISSP Bootcamp — Cohorte de décembre (J-35) : 2 places payées sur 10, 3 attendues à ce jour. En retard de 1 place.");
    expect(text).toContain("En cours : 1 inscription commencée non payée, 1 place tenue.");
    expect(text).toContain("• Bâtisseur IA — Entrée du 23 janvier : campagne ouverte à partir du 24 novembre.");
    expect(text).toContain("- CISSP Bootcamp : 1 240 visites, 21 analyses de profil");
    expect(text).not.toContain("- Bâtisseur IA :");
    expect(text).toContain("- « Mini-cas : le budget sécurité » (LinkedIn) : 31 visites");
    expect(text).toContain("Le pilotage : https://x.test/admin/pilotage");
    expect(text).not.toMatch(/\d{1,2} ?h ?\d{0,2}\b|\d{1,2}:\d{2}/);
  });

  it("keys the week on its Monday", () => {
    expect(reportWeekKey(monday)).toBe("2026-11-09");
    expect(reportWeekKey(new Date("2026-11-15T22:00:00Z"))).toBe("2026-11-09");
  });
});

describe("loading the cohorts", () => {
  it("uses the goal or the capacity, counts paid seats, recent unpaid starts and sources", async () => {
    db.cohort.findMany.mockResolvedValue([
      {
        id: 3, program: "cissp", name: "Cohorte de décembre", startsAt: start, capacity: 12, targetSeats: 10,
        registrations: [
          { status: "paid", paidAt: at(-50), createdAt: at(-50), lead: { utmSource: "linkedin", source: null } },
          { status: "paid", paidAt: at(-45), createdAt: at(-46), lead: { utmSource: null, source: null } },
          { status: "pending", paidAt: null, createdAt: new Date(monday.getTime() - 2 * DAY), lead: { utmSource: null, source: null } },
          { status: "pending", paidAt: null, createdAt: new Date(monday.getTime() - 30 * DAY), lead: { utmSource: null, source: null } },
        ],
        seatHolds: [{ id: 1 }],
      },
    ]);
    const [c] = await loadPilotCohorts(monday);
    expect(c!.pilot.goal).toBe(10);
    expect(c!.pilot.paid).toBe(2);
    expect(c!.pendingRecent).toBe(1);
    expect(c!.held).toBe(1);
    expect(c!.sources).toEqual([{ source: "LinkedIn", count: 1 }, { source: "Direct", count: 1 }]);
  });

  it("names sources plainly", () => {
    expect(sourceLabel("LinkedIn_post")).toBe("LinkedIn");
    expect(sourceLabel(null)).toBe("Direct");
    expect(sourceLabel("partenaire-abidjan")).toBe("partenaire-abidjan");
  });
});

describe("sending the Monday report", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.cohort.findMany.mockResolvedValue([]);
    db.siteSetting.findUnique.mockResolvedValue(null);
  });

  it("sends on Mondays only, once per week, to the admin", async () => {
    expect(await sendMondayReport(new Date("2026-11-10T05:30:00Z"))).toBe("not_monday");
    expect(mail.sendEmail).not.toHaveBeenCalled();

    expect(await sendMondayReport(monday)).toBe("sent");
    expect(mail.sendEmail.mock.calls[0]![0].to).toBe("ben@x.test");
    expect(db.siteSetting.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { key: "pilotage_report", value: { week: "2026-11-09" } } }));

    db.siteSetting.findUnique.mockResolvedValue({ key: "pilotage_report", value: { week: "2026-11-09" } });
    expect(await sendMondayReport(new Date("2026-11-09T18:00:00Z"))).toBe("already");
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("tries again next run when the e-mail fails", async () => {
    mail.sendEmail.mockResolvedValueOnce({ sent: false, id: null, reason: "Resend down" });
    expect(await sendMondayReport(monday)).toBe("failed");
    expect(db.siteSetting.upsert).not.toHaveBeenCalled();
  });
});
