/**
 * Preparation documents (Ben, 24/09): files Ben uploads from the admin and
 * attaches to the onboarding e-mail of a paid participant. Pure helpers here;
 * the database and the e-mail live in lib/onboarding.ts.
 */

/** One file at most; Resend accepts 40 MB per message, so the total stays well under. */
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

/** What Ben is likely to send: course material and planning, nothing executable. */
export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/zip": "zip",
  "application/x-zip-compressed": "zip",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export type DocumentSummary = { id: number; name: string; filename: string; size: number; active: boolean };

export type AttachmentPlan = { ok: true; documents: DocumentSummary[]; totalBytes: number } | { ok: false; error: string };

/** Which of the library's documents go out, and whether they fit in one e-mail. */
export function planAttachments(library: DocumentSummary[], selectedIds: number[]): AttachmentPlan {
  const wanted = new Set(selectedIds);
  const documents = library.filter((d) => d.active && wanted.has(d.id));
  if (documents.length === 0) return { ok: false, error: "Aucun document sélectionné." };
  const totalBytes = documents.reduce((sum, d) => sum + d.size, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    return { ok: false, error: `Les pièces jointes pèsent ${formatBytes(totalBytes)} ; la limite par e-mail est ${formatBytes(MAX_TOTAL_BYTES)}. Envoyez en deux fois.` };
  }
  return { ok: true, documents, totalBytes };
}

/** Checks an upload before it is stored. Returns the error to show, or null. */
export function validateUpload(input: { size: number; mimeType: string; filename: string }): string | null {
  if (input.size <= 0) return "Le fichier est vide.";
  if (input.size > MAX_FILE_BYTES) return `Le fichier dépasse ${formatBytes(MAX_FILE_BYTES)}.`;
  if (!ALLOWED_MIME_TYPES[input.mimeType]) return "Format accepté : PDF, Word, PowerPoint, Excel, ZIP, PNG ou JPG.";
  if (!input.filename.trim()) return "Le fichier n'a pas de nom.";
  return null;
}

/** "• Programme des 15 jours (PDF, 1,2 Mo)" per line, as the template's {{liste_documents}}. */
export function documentList(documents: DocumentSummary[]): string {
  return documents.map((d) => `• ${d.name} (${extension(d.filename).toUpperCase()}, ${formatBytes(d.size)})`).join("\n");
}

/** A file name safe for an attachment header: no path, no control characters. */
export function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "document";
  const cleaned = base.replace(/[\u0000-\u001f"]/g, "").trim();
  return cleaned || "document";
}

export function extension(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match ? match[1] : "";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}
