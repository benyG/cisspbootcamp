import { describe, expect, it } from "vitest";

import { SITE_DEFAULTS, siteSettingsSchema, splitHighlight } from "@/lib/site-settings";

describe("site settings", () => {
  it("les valeurs par défaut respectent leur propre schéma", () => {
    expect(siteSettingsSchema.safeParse(SITE_DEFAULTS).success).toBe(true);
  });

  it("refuse un nombre de promesses différent de trois", () => {
    const bad = { ...SITE_DEFAULTS.hero, promises: SITE_DEFAULTS.hero.promises.slice(0, 2) };
    expect(siteSettingsSchema.shape.hero.safeParse(bad).success).toBe(false);
  });

  it("refuse un numéro WhatsApp hors format international", () => {
    expect(siteSettingsSchema.shape.contact.safeParse({ ...SITE_DEFAULTS.contact, whatsapp: "77 123 45 67" }).success).toBe(false);
    expect(siteSettingsSchema.shape.contact.safeParse({ ...SITE_DEFAULTS.contact, whatsapp: "+221771234567" }).success).toBe(true);
  });
});

describe("splitHighlight", () => {
  it("isole la partie à colorer", () => {
    expect(splitHighlight("Ne préparez plus le CISSP {{au hasard.}}")).toEqual({
      before: "Ne préparez plus le CISSP ",
      highlight: "au hasard.",
      after: "",
    });
  });

  it("laisse un titre sans marqueur intact", () => {
    expect(splitHighlight("Titre simple")).toEqual({ before: "Titre simple", highlight: "", after: "" });
  });
});
