import { describe, expect, it } from "vitest";

import { getLibraryDoc, listLibrary, parseDocument, renderMarkdown } from "@/lib/library";

describe("library", () => {
  it("reads every document kept in content/library, with its front matter", () => {
    const docs = listLibrary();
    expect(docs.map((d) => d.slug).sort()).toEqual(["fiches-reflexes-batisseur-ia", "guide-exploitation", "ia-privee-souveraine", "offre-entreprises", "programme-batisseur-ia"]);
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
