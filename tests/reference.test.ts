import { describe, expect, it } from "vitest";

import { newReference } from "@/lib/registration";

describe("newReference", () => {
  it("a une forme lisible et dictable au téléphone", () => {
    expect(newReference()).toMatch(/^CB-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it("évite les caractères ambigus", () => {
    const refs = Array.from({ length: 300 }, newReference).join("");
    expect(refs).not.toMatch(/[01IO]/);
  });

  it("ne se répète pas", () => {
    expect(new Set(Array.from({ length: 1000 }, newReference)).size).toBe(1000);
  });
});
