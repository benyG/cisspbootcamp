import { describe, expect, it } from "vitest";

import { createToken, safeEquals } from "@/lib/tokens";

describe("createToken", () => {
  it("produit un jeton utilisable tel quel dans une URL", () => {
    expect(createToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("porte 256 bits d'entropie", () => {
    expect(Buffer.from(createToken(), "base64url")).toHaveLength(32);
  });

  it("ne se répète pas", () => {
    const tokens = new Set(Array.from({ length: 500 }, createToken));
    expect(tokens.size).toBe(500);
  });
});

describe("safeEquals", () => {
  it("reconnaît deux valeurs identiques", () => {
    expect(safeEquals("verif-hash", "verif-hash")).toBe(true);
  });

  it("rejette des valeurs différentes", () => {
    expect(safeEquals("verif-hash", "verif-hasi")).toBe(false);
  });

  it("rejette des longueurs différentes sans lever d'erreur", () => {
    expect(safeEquals("court", "beaucoup-plus-long")).toBe(false);
  });

  it("rejette la chaîne vide face à un secret", () => {
    expect(safeEquals("", "secret")).toBe(false);
  });
});
