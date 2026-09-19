import { describe, expect, it } from "vitest";

import { isAdminEmail } from "@/lib/admin";

const ADMIN = "coach@example.com";

describe("isAdminEmail", () => {
  it("accepte l'adresse admin exacte", () => {
    expect(isAdminEmail(ADMIN, ADMIN)).toBe(true);
  });

  it("ignore la casse et les espaces", () => {
    expect(isAdminEmail("  Coach@Example.COM ", ADMIN)).toBe(true);
  });

  it("refuse toute autre adresse", () => {
    expect(isAdminEmail("autre@example.com", ADMIN)).toBe(false);
    expect(isAdminEmail("coach@example.com.attacker.test", ADMIN)).toBe(false);
  });

  it("refuse une adresse absente", () => {
    expect(isAdminEmail(null, ADMIN)).toBe(false);
    expect(isAdminEmail(undefined, ADMIN)).toBe(false);
    expect(isAdminEmail("", ADMIN)).toBe(false);
  });

  it("refuse tout le monde si ADMIN_EMAIL n'est pas configuré", () => {
    expect(isAdminEmail(ADMIN, "")).toBe(false);
  });
});
