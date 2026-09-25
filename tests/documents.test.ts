import { describe, expect, it } from "vitest";

import { ATTACHMENT_BUDGET_BYTES, MAX_FILE_BYTES, blobPathnameFor, documentList, formatBytes, planAttachments, safeFilename, validateUpload } from "@/lib/documents";
import { signDocumentLink, verifyDocumentLink } from "@/lib/document-links";

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

  it("joint tant que le budget tient, puis passe en lien de téléchargement", () => {
    const big = [
      { id: 7, name: "Planning", filename: "p.pdf", size: 2_000_000, active: true },
      { id: 8, name: "Support complet", filename: "s.pdf", size: 28_000_000, active: true },
      { id: 9, name: "Lectures", filename: "l.pdf", size: 1_000_000, active: true },
    ];
    const plan = planAttachments(big, [7, 8, 9]);
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.attached.map((d) => d.id)).toEqual([7, 9]);
      expect(plan.linked.map((d) => d.id)).toEqual([8]);
      expect(plan.totalBytes).toBe(31_000_000);
    }
  });

  it("le budget des pièces jointes reste sous la limite des messageries", () => {
    expect(ATTACHMENT_BUDGET_BYTES * 4 / 3).toBeLessThan(25 * 1024 * 1024);
  });
});

describe("validateUpload", () => {
  it("accepte un PDF de taille raisonnable", () => {
    expect(validateUpload({ size: 500_000, mimeType: "application/pdf", filename: "a.pdf" })).toBeNull();
  });
  it("refuse un exécutable, un fichier vide ou trop lourd", () => {
    expect(validateUpload({ size: 10, mimeType: "application/x-msdownload", filename: "a.exe" })).toMatch(/Format/);
    expect(validateUpload({ size: 0, mimeType: "application/pdf", filename: "a.pdf" })).toMatch(/vide/);
    expect(validateUpload({ size: MAX_FILE_BYTES + 1, mimeType: "application/pdf", filename: "a.pdf" })).toMatch(/dépasse 30 Mo/);
  });
  it("accepte un fichier de 30 Mo pile (Ben, 25/09)", () => {
    expect(validateUpload({ size: 30 * 1024 * 1024, mimeType: "application/pdf", filename: "support.pdf" })).toBeNull();
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

describe("liens de téléchargement signés", () => {
  const secret = "test-secret";
  it("vérifie un lien signé et en extrait document et lead", () => {
    const token = signDocumentLink(12, 345, secret);
    expect(verifyDocumentLink(token, secret)).toEqual({ documentId: 12, leadId: 345 });
  });
  it("refuse un lien modifié ou signé avec un autre secret", () => {
    const token = signDocumentLink(12, 345, secret);
    expect(verifyDocumentLink(token.replace(/^12\./, "13."), secret)).toBeNull();
    expect(verifyDocumentLink(token, "autre")).toBeNull();
    expect(verifyDocumentLink("n'importe-quoi", secret)).toBeNull();
  });
  it("range les fichiers par formation avec un nom sûr", () => {
    expect(blobPathnameFor("cissp", "Support du jour 1.pdf", "abc123")).toBe("documents/cissp/abc123-Support-du-jour-1.pdf");
  });
  it("met le lien dans la liste des documents", () => {
    const list = documentList([{ id: 5, name: "Support", filename: "s.pdf", size: 20 * 1024 * 1024, active: true }], { 5: "https://x/documents/t" });
    expect(list).toBe("• Support (PDF, 20 Mo) : à télécharger ici https://x/documents/t");
  });
});
