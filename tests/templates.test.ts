import { describe, expect, it } from "vitest";

import { leadVars, renderTemplate, waMeLink } from "@/lib/messaging/templates";

describe("renderTemplate", () => {
  it("remplace les marqueurs connus", () => {
    expect(renderTemplate("Bonjour {{prenom}}, rdv : {{lien_rdv}}", { prenom: "Awa", lien_rdv: "https://x/rdv" })).toBe("Bonjour Awa, rdv : https://x/rdv");
  });

  it("laisse visible un marqueur inconnu ou vide, pour que la faute se voie", () => {
    expect(renderTemplate("{{prenom}} {{inconnu}}", { prenom: "Awa" })).toBe("Awa {{inconnu}}");
    expect(renderTemplate("{{cohorte}}", { cohorte: null })).toBe("{{cohorte}}");
  });

  it("tolère les espaces dans les accolades", () => {
    expect(renderTemplate("{{ prenom }}", { prenom: "Awa" })).toBe("Awa");
  });
});

describe("waMeLink", () => {
  it("retire le + et encode le texte", () => {
    const link = waMeLink("+221 77 123 45 67", "Bonjour Awa, ça va ?");
    expect(link.startsWith("https://wa.me/221771234567?text=")).toBe(true);
    expect(link).toContain(encodeURIComponent("ça va ?"));
  });
});

describe("leadVars", () => {
  it("construit les liens à partir du jeton de résultat", () => {
    const vars = leadVars({ firstName: "Awa", lastName: "Diop", appUrl: "https://cisspbootcamp.online", resultToken: "tok" });
    expect(vars.lien_rdv).toBe("https://cisspbootcamp.online/rdv?t=tok");
    expect(vars.lien_paiement).toBe("https://cisspbootcamp.online/inscription?t=tok");
  });

  it("retombe sur le lien de réservation générique sans jeton", () => {
    expect(leadVars({ firstName: "A", lastName: "B", appUrl: "https://x" }).lien_rdv).toBe("https://x/rdv");
  });
});
