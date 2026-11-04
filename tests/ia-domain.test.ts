import { describe, expect, it } from "vitest";

import { iaOrigin, iaPath, iaRoute, iaUrl, normalizeDomain } from "@/lib/ia-domain";

const config: { iaDomain: string | null; appUrl: string } = { iaDomain: "batisseur-ia.com", appUrl: "https://www.cisspbootcamp.online" };
const route = (host: string, pathname: string, search = "", c = config) => iaRoute({ host, pathname, search }, c);

describe("domaine séparé du Bâtisseur IA (Ben, 04/11)", () => {
  it("lit le domaine sans protocole ni www", () => {
    expect(normalizeDomain("https://www.Batisseur-IA.com/")).toBe("batisseur-ia.com");
    expect(normalizeDomain("batisseur-ia.com")).toBe("batisseur-ia.com");
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("pas un domaine")).toBeNull();
  });

  it("écrit les chemins IA sans /ia sur le domaine IA, et ne change rien sans domaine", () => {
    expect(iaPath("/ia", "batisseur-ia.com")).toBe("/");
    expect(iaPath("/ia/diagnostic", "batisseur-ia.com")).toBe("/diagnostic");
    expect(iaPath("/ia#programme", "batisseur-ia.com")).toBe("/#programme");
    expect(iaPath("/ia/inscription?t=abc", "batisseur-ia.com")).toBe("/inscription?t=abc");
    expect(iaPath("/iadmin", "batisseur-ia.com")).toBe("/iadmin");
    expect(iaPath("/ia/diagnostic", null)).toBe("/ia/diagnostic");
    expect(iaUrl("/ia/guide", "https://www.cisspbootcamp.online/", "batisseur-ia.com")).toBe("https://batisseur-ia.com/guide");
    expect(iaUrl("/ia/guide", "https://www.cisspbootcamp.online/", null)).toBe("https://www.cisspbootcamp.online/ia/guide");
    expect(iaOrigin("https://www.cisspbootcamp.online", null)).toBe("https://www.cisspbootcamp.online");
  });

  it("sert les pages IA à des adresses propres sur leur domaine", () => {
    expect(route("batisseur-ia.com", "/")).toEqual({ kind: "rewrite", path: "/ia" });
    expect(route("www.batisseur-ia.com", "/diagnostic")).toEqual({ kind: "rewrite", path: "/ia/diagnostic" });
    expect(route("batisseur-ia.com", "/calendrier/tok")).toEqual({ kind: "rewrite", path: "/ia/calendrier/tok" });
    expect(route("batisseur-ia.com", "/inscription")).toEqual({ kind: "rewrite", path: "/ia/inscription" });
    expect(route("batisseur-ia.com", "/opengraph-image")).toEqual({ kind: "rewrite", path: "/ia/opengraph-image" });
    // Already prefixed links, payment returns, receipts, privacy and the API work as they are.
    for (const path of ["/ia/guide", "/inscription/merci", "/inscription/solde/CB-AAAA-BBBB", "/inscription/recu/CB-AAAA-BBBB", "/desinscription/x", "/confidentialite", "/api/track"]) {
      expect(route("batisseur-ia.com", path)).toEqual({ kind: "next" });
    }
    expect(route("batisseur-ia.com", "/robots.txt")).toEqual({ kind: "rewrite", path: "/api/ia/robots" });
    expect(route("batisseur-ia.com", "/sitemap.xml")).toEqual({ kind: "rewrite", path: "/api/ia/sitemap" });
    expect(route("batisseur-ia.com", "/admin/leads", "?x=1")).toEqual({ kind: "redirect", url: "https://www.cisspbootcamp.online/admin/leads?x=1" });
  });

  it("envoie /ia du site CISSP vers le domaine IA, en gardant les paramètres", () => {
    expect(route("www.cisspbootcamp.online", "/ia")).toEqual({ kind: "redirect", url: "https://batisseur-ia.com/" });
    expect(route("cisspbootcamp.online", "/ia/inscription", "?t=abc&entree=2")).toEqual({ kind: "redirect", url: "https://batisseur-ia.com/inscription?t=abc&entree=2" });
    expect(route("www.cisspbootcamp.online", "/scanner")).toEqual({ kind: "next" });
    expect(route("www.cisspbootcamp.online", "/iadmin")).toEqual({ kind: "next" });
  });

  it("laisse les aperçus, le local et l'absence de domaine tranquilles", () => {
    expect(route("cisspbootcamp-git-x.vercel.app", "/ia")).toEqual({ kind: "next" });
    expect(route("localhost:3000", "/ia/diagnostic")).toEqual({ kind: "next" });
    expect(route("www.cisspbootcamp.online", "/ia", "", { ...config, iaDomain: null })).toEqual({ kind: "next" });
  });
});
