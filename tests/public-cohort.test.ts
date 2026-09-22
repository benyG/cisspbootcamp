import { describe, expect, it } from "vitest";

import { formatCohortMonth } from "@/lib/cohorts";

/**
 * Regression for the 22/09 outage: a Date that went through JSON must be
 * rebuilt before formatting. formatCohortMonth must throw on a string, so the
 * type system is our guard — this test pins the failure mode we saw.
 */
describe("dates traversant un cache JSON", () => {
  it("une date rejouée depuis JSON redevient formatable une fois reconstruite", () => {
    const serialized = JSON.parse(JSON.stringify({ startsAt: new Date("2027-01-11T18:00:00.000Z") }));
    expect(typeof serialized.startsAt).toBe("string");
    expect(formatCohortMonth(new Date(serialized.startsAt))).toBe("janvier 2027");
  });

  it("la valeur brute du cache n'est pas une Date", () => {
    const serialized = JSON.parse(JSON.stringify({ startsAt: new Date() }));
    expect(() => (serialized.startsAt as Date).toISOString()).toThrow();
  });
});
