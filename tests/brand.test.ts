import { describe, expect, it } from "vitest";

import { BRAND_COLORS, CANVAS, IMAGE_PROMPT_MAX, VIDEO_PROMPT_MAX, brandedImagePrompt, brandedVideoPrompt, defaultKeyword, headlineParts, headlineSize } from "@/lib/marketing/brand";
import { composeVisual } from "@/lib/marketing/compose";

describe("charte des visuels générés (Ben, 03/10)", () => {
  it("enveloppe la scène dans les règles photo de la marque", () => {
    const prompt = brandedImagePrompt("  A CISO presents a risk map to the board  ");
    expect(prompt.startsWith("A CISO presents a risk map to the board\n\n")).toBe(true);
    for (const rule of [/Black African francophone cybersecurity professionals/, /#071A33/, /#17B890/, /Strictly no text/, /hooded hacker/, /Matrix code/]) expect(prompt).toMatch(rule);
  });

  it("une scène trop longue est coupée, jamais les règles", () => {
    const prompt = brandedImagePrompt("word ".repeat(600));
    expect(prompt.length).toBeLessThanOrEqual(IMAGE_PROMPT_MAX);
    expect(prompt).toMatch(/Strictly no text[\s\S]*holograms\.$/);
  });

  it("le prompt vidéo garde celui de Ben et ajoute la charte, dans la limite de MiniMax", () => {
    const prompt = brandedVideoPrompt("[Push in] A security analyst " + "x".repeat(1190));
    expect(prompt.length).toBeLessThanOrEqual(VIDEO_PROMPT_MAX);
    expect(prompt).toMatch(/^\[Push in\]/);
    expect(prompt).toMatch(/night-blue shadows/);
  });

  it("un format par canal ; LinkedIn est fait en 3:4 puis recadré en 4:5", () => {
    expect(CANVAS.linkedin).toEqual({ width: 1080, height: 1350, aspectRatio: "3:4" });
    expect(CANVAS.whatsapp_status.aspectRatio).toBe("9:16");
    expect(CANVAS.whatsapp_group).toMatchObject({ width: 1080, height: 1080 });
    expect(BRAND_COLORS.green).toBe("#17B890");
  });

  it("un seul mot en vert : un chiffre s'il y en a un, sinon le mot le plus long", () => {
    expect(defaultKeyword("4 places avant le 15 octobre")).toBe("4");
    expect(defaultKeyword("Raisonner en manager, pas en technicien")).toBe("technicien");
    expect(defaultKeyword("")).toBe("");
  });

  it("découpe le titre en mots, le mot-clé en vert, la virgule avec son mot", () => {
    expect(headlineParts("Raisonner en Manager, pas en technicien", "manager")).toEqual([
      { text: "Raisonner", green: false },
      { text: "en", green: false },
      { text: "Manager,", green: true },
      { text: "pas", green: false },
      { text: "en", green: false },
      { text: "technicien", green: false },
    ]);
    expect(headlineParts("Le titre Associate of ISC²", "Associate of").filter((p) => p.green).map((p) => p.text)).toEqual(["Associate", "of"]);
    expect(headlineParts("Sans mot vert", "absent").some((p) => p.green)).toBe(false);
    expect(headlineParts("  ", "x")).toEqual([]);
  });

  it("le titre rapetisse quand il s'allonge", () => {
    expect(headlineSize("4 places", 1080)).toBeGreaterThan(headlineSize("Raisonner en manager, pas en technicien", 1080));
  });

  it("compose un PNG à la taille du canal, avec les polices du site", async () => {
    // A 1×1 JPEG stands in for MiniMax's photograph.
    const photo = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==", "base64");
    const png = await composeVisual({ photo, photoType: "image/jpeg", channel: "linkedin", headline: "4 places, clôture le 15 octobre", keyword: "4" });
    expect([...png.slice(1, 4)].map((c) => String.fromCharCode(c)).join("")).toBe("PNG");
    const view = new DataView(png.buffer, png.byteOffset);
    expect([view.getUint32(16), view.getUint32(20)]).toEqual([1080, 1350]);
  }, 30_000);
});
