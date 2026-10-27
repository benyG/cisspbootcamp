import { describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ availabilityRule: { findMany: vi.fn() }, booking: { findMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://www.cisspbootcamp.online" } }));
vi.mock("@/lib/messaging/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/tracking/server", () => ({ recordServerEvent: vi.fn() }));
const google = vi.hoisted(() => ({ getCredential: vi.fn(), fetchBusy: vi.fn(), createCallEvent: vi.fn(), cancelCallEvent: vi.fn(), moveCallEvent: vi.fn(), CalendarNotConnectedError: class extends Error {} }));
vi.mock("@/lib/calendar/google", () => google);

import { listSlots } from "@/lib/booking";

describe("agenda Google déconnecté (Ben, 27/10)", () => {
  it("la réservation se ferme proprement au lieu de faire planter la page", async () => {
    google.getCredential.mockResolvedValue({ timeZone: "Africa/Douala", calendarId: "primary" });
    db.availabilityRule.findMany.mockResolvedValue([{ kind: "discovery", weekday: 1, startMinute: 600, endMinute: 720 }]);
    google.fetchBusy.mockRejectedValue(new Error("Rafraîchissement du token Google refusé (400)"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(listSlots(new Date("2026-10-27T08:00:00Z"))).resolves.toEqual({ available: false, reason: "calendar_error" });
  });
});
