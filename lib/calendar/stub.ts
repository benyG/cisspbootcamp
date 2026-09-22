import type { GoogleCredential } from "@prisma/client";

/**
 * In-memory stand-in for Google Calendar, used only by the Playwright journey
 * (tests/e2e/journey.spec.ts) where no Google account exists. Enabled solely by
 * E2E_CALENDAR_STUB=1 — never set it on Vercel: every booking would then be
 * recorded in the database without any real calendar event.
 */
export function calendarStubEnabled(): boolean {
  return process.env.E2E_CALENDAR_STUB === "1";
}

export const STUB_CREDENTIAL: GoogleCredential = {
  id: 1,
  accountEmail: "stub@example.test",
  refreshTokenSealed: "",
  calendarId: "primary",
  timeZone: "Africa/Douala",
  connectedAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

export function stubEvent(requestId: string): { eventId: string; meetUrl: string } {
  return { eventId: `stub-${requestId}`, meetUrl: `https://meet.google.com/stub-${requestId.slice(0, 8)}` };
}
