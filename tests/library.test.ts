import { describe, expect, it } from "vitest";

import { getLibraryDoc, listLibrary, listLibraryDecks, parseDocument, readLibraryDeck, renderMarkdown } from "@/lib/library";

const DAYS = [1, 2, 3, 4, 5, 6];

describe("library", () => {
  it("reads every document kept in content/library, with its front matter", () => {
    const docs = listLibrary();
    expect(docs.map((d) => d.slug).sort()).toEqual([...DAYS.map((n) => `batisseur-ia-j${n}`), "fiches-reflexes-batisseur-ia", "guide-exploitation", "ia-privee-souveraine", "offre-entreprises", "programme-batisseur-ia"]);
    for (const d of docs) {
      expect(d.title.length).toBeGreaterThan(5);
      expect(d.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(d.body.length).toBeGreaterThan(500);
    }
  });

  it("shares only the participants' sheets", () => {
    expect(listLibrary().filter((d) => d.audience === "participants").map((d) => d.slug)).toEqual(["fiches-reflexes-batisseur-ia"]);
    expect(getLibraryDoc("guide-exploitation")?.audience).toBe("internal");
  });

  it("links each Bâtisseur IA trainer's guide to its presentation, kept with the library", () => {
    expect(listLibraryDecks()).toEqual(DAYS.map((n) => `Batisseur-IA-J${n}.pptx`));
    for (const n of DAYS) {
      const guide = getLibraryDoc(`batisseur-ia-j${n}`);
      expect(guide).toMatchObject({ category: "ia-formateur", audience: "internal", deck: `Batisseur-IA-J${n}.pptx` });
      const deck = readLibraryDeck(guide!.deck!);
      expect(deck?.subarray(0, 2).toString()).toBe("PK");
    }
  });

  it("serves only presentations of the library", () => {
    expect(readLibraryDeck("../../package.json")).toBeNull();
    expect(readLibraryDeck("..%2Fx.pptx")).toBeNull();
    expect(readLibraryDeck("Introuvable.pptx")).toBeNull();
    expect(parseDocument("x", "---\ntitle: Titre long\ncategory: exploitation\ndeck: ../secret.pptx\n---\nTexte")?.deck).toBeNull();
  });

  it("refuses unknown slugs and paths outside the library", () => {
    expect(getLibraryDoc("../package")).toBeNull();
    expect(getLibraryDoc("introuvable")).toBeNull();
    expect(parseDocument("x", "pas de front matter")).toBeNull();
    expect(parseDocument("x", "---\ntitle: T\ncategory: inconnue\n---\nTexte")).toBeNull();
  });

  it("parses the front matter and keeps internal as the default audience", () => {
    const doc = parseDocument("essai", "---\ntitle: Essai : deux points\ncategory: exploitation\nupdated: 2026-11-24\n---\n\n## Titre\n\nTexte.");
    expect(doc).toMatchObject({ slug: "essai", title: "Essai : deux points", category: "exploitation", audience: "internal", updated: "2026-11-24", body: "## Titre\n\nTexte." });
  });

  it("renders tables, task lists, code and links", () => {
    const html = renderMarkdown("| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- [ ] À faire\n\n```markdown\n# CLAUDE.md\n```\n\n[site](https://example.com) et [admin](/admin)");
    expect(html).toContain("<table>");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("<pre><code");
    expect(html).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('<a href="/admin">admin</a>');
  });
});
