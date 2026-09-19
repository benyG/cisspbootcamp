import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { decrypt, encrypt, loadKey } from "@/lib/crypto";

const KEY = randomBytes(32);

describe("encrypt / decrypt", () => {
  it("restitue le texte d'origine", () => {
    const sealed = encrypt("1//refresh-token-très-secret", KEY);
    expect(decrypt(sealed, KEY)).toBe("1//refresh-token-très-secret");
  });

  it("produit une valeur différente à chaque chiffrement", () => {
    expect(encrypt("même", KEY)).not.toBe(encrypt("même", KEY));
  });

  it("tient dans un VARCHAR sans caractère spécial", () => {
    expect(encrypt("x".repeat(200), KEY)).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("refuse une valeur altérée", () => {
    const sealed = encrypt("secret", KEY);
    const tampered = sealed.slice(0, -2) + (sealed.endsWith("A") ? "BB" : "AA");
    expect(() => decrypt(tampered, KEY)).toThrow();
  });

  it("refuse une autre clé", () => {
    const sealed = encrypt("secret", KEY);
    expect(() => decrypt(sealed, randomBytes(32))).toThrow();
  });
});

describe("loadKey", () => {
  it("accepte 32 octets en base64", () => {
    expect(loadKey(KEY.toString("base64"))).toHaveLength(32);
  });

  it("refuse une clé absente ou de mauvaise taille", () => {
    expect(() => loadKey(undefined)).toThrow(/manquante/);
    expect(() => loadKey(randomBytes(16).toString("base64"))).toThrow(/32 octets/);
  });
});
