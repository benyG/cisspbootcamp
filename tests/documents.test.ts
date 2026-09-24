import { describe, expect, it } from "vitest";

import { MAX_TOTAL_BYTES, documentList, formatBytes, planAttachments, safeFilename, validateUpload } from "@/lib/documents";

const library = [
  { id: 1, name: "Programme des 15 jours", filename: "programme.pdf", size: 1_200_000, active: true },
  { id: 2, name: "Lectures", filename: "lectures.docx", size: 300_000, active: true },
  { id: 3, name: "Ancien planning", filename: "old.pdf", size: 100, active: false },
];

describe("planAttachments", () => {
  it("garde les documents choisis et actifs", () => {
    const plan = planAttachments(library, [1, 3, 99]);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.documents.map((d) => d.id)).toEqual([1]);
      expect(plan.totalBytes).toBe(1_200_000);
    }
  });

  it("refuse une sélection vide", () => {
    expect(planAttachments(library, [])).toMatchObject({ ok: false });
    expect(planAttachments(library, [3])).toMatchObject({ ok: false });
  });

  it("refuse un total au-delà de la limite d'un e-mail", () => {
    const heavy = [{ id: 7, name: "Vidéo", filename: "v.zip", size: MAX_TOTAL_BYTES + 1, active: true }];
    const plan = planAttachments(heavy, [7]);
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain("deux fois");
  });
});

describe("validateUpload", () => {
  it("accepte un PDF de taille raisonnable", () => {
    expect(validateUpload({ size: 500_000, mimeType: "application/pdf", filename: "a.pdf" })).toBeNull();
  });
  it("refuse un exécutable, un fichier vide ou trop lourd", () => {
    expect(validateUpload({ size: 10, mimeType: "application/x-msdownload", filename: "a.exe" })).toMatch(/Format/);
    expect(validateUpload({ size: 0, mimeType: "application/pdf", filename: "a.pdf" })).toMatch(/vide/);
    expect(validateUpload({ size: 9 * 1024 * 1024, mimeType: "application/pdf", filename: "a.pdf" })).toMatch(/dépasse/);
  });
});

describe("documentList et noms de fichiers", () => {
  it("liste chaque document sur une ligne avec format et poids", () => {
    expect(documentList(library.slice(0, 2))).toBe("• Programme des 15 jours (PDF, 1,1 Mo)\n• Lectures (DOCX, 293 Ko)");
  });
  it("nettoie le nom de fichier", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename('C:\\docs\\plan".pdf')).toBe("plan.pdf");
    expect(safeFilename("")).toBe("document");
  });
  it("formate les tailles en français", () => {
    expect(formatBytes(512)).toBe("512 o");
    expect(formatBytes(2048)).toBe("2 Ko");
  });
});
