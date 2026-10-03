import { describe, expect, it } from "vitest";

import { statusOf, toLittleText } from "@/lib/linkedin";

describe("texte LinkedIn (little text)", () => {
  it("échappe les caractères réservés et garde les hashtags cliquables", () => {
    expect(toLittleText("CISSP (8 domaines) : *méthode* & rythme")).toBe("CISSP \\(8 domaines\\) : \\*méthode\\* & rythme");
    expect(toLittleText("Prêt ?\n\n#CISSP #Cybersécurité")).toBe("Prêt ?\n\n{hashtag|\\#|CISSP} {hashtag|\\#|Cybersécurité}");
    expect(toLittleText("Note #1 du jour")).toBe("Note {hashtag|\\#|1} du jour");
    expect(toLittleText("a#b @ben [x] {y} <z> ~ _ |")).toBe("a\\#b \\@ben \\[x\\] \\{y\\} \\<z\\> \\~ \\_ \\|");
  });

  it("laisse les liens intacts", () => {
    expect(toLittleText("https://www.cisspbootcamp.online/scanner?utm_source=linkedin&utm_content=li-abc123")).toBe("https://www.cisspbootcamp.online/scanner?utm\\_source=linkedin&utm\\_content=li-abc123");
  });
});

describe("état de la connexion LinkedIn", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  it("non configurée, déconnectée, expirée, bientôt expirée", () => {
    expect(statusOf(null, false, now)).toEqual({ state: "not_configured" });
    expect(statusOf(null, true, now)).toEqual({ state: "disconnected" });
    expect(statusOf({ name: "Ben", expiresAt: new Date("2026-10-01T00:00:00Z") }, true, now)).toEqual({ state: "expired", name: "Ben" });
    expect(statusOf({ name: "Ben", expiresAt: new Date("2026-10-08T00:00:00Z") }, true, now)).toMatchObject({ state: "connected", expiresSoon: true });
    expect(statusOf({ name: "Ben", expiresAt: new Date("2026-12-01T00:00:00Z") }, true, now)).toMatchObject({ state: "connected", expiresSoon: false });
  });
});
