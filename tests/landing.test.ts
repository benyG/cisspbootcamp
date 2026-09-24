import { describe, expect, it } from "vitest";

import { seatsLine } from "@/components/landing/sections";
import { buildGauge } from "@/lib/cohorts";

describe("seatsLine (docs/LANDING.md §15)", () => {
  it("annonce la capacité tant qu'aucune place n'est prise", () => {
    expect(seatsLine(buildGauge({ capacity: 10, confirmed: 0, preEngaged: 3 }))).toBe("10 participants maximum");
  });

  it("montre les places restantes dès la première place payée ou tenue", () => {
    expect(seatsLine(buildGauge({ capacity: 10, confirmed: 1, preEngaged: 0 }))).toBe("9 places restantes sur 10");
    expect(seatsLine(buildGauge({ capacity: 10, confirmed: 0, held: 2, preEngaged: 0 }))).toBe("8 places restantes sur 10");
  });
});
