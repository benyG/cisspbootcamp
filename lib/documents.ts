/**
 * Preparation documents (Ben, 24/09): files Ben uploads from the admin and
 * attaches to the onboarding e-mail of a paid participant. Pure helpers here;
 * the database and the e-mail live in lib/onboarding.ts.
 */

/**
 * Upload limit per file (Ben, 25/09). Files go straight from the browser to
 * private Vercel Blob storage, so no function body limit applies.
 */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

/**
 * Attachments stop here, in raw bytes. Base64 adds a third, and Gmail and
 * most inboxes refuse messages over 25 MB: past this budget, a document goes
 * as a personal download link in the same e-mail instead of an attachment.
 */
export const ATTACHMENT_BUDGET_BYTES = 15 * 1024 * 1024;

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

export type AttachmentPlan =
  | { ok: true; documents: DocumentSummary[]; attached: DocumentSummary[]; linked: DocumentSummary[]; totalBytes: number }
  | { ok: false; error: string };

/**
 * Which of the library's documents go out, and how: attached while the
 * running total fits the budget, as a download link past it. Order is kept,
 * so the list in the e-mail matches the library.
 */
export function planAttachments(library: DocumentSummary[], selectedIds: number[], budget = ATTACHMENT_BUDGET_BYTES, options: { allowEmpty?: boolean } = {}): AttachmentPlan {
  const wanted = new Set(selectedIds);
  const documents = library.filter((d) => d.active && wanted.has(d.id));
  if (documents.length === 0 && !options.allowEmpty) return { ok: false, error: "Aucun document sélectionné." };
  const attached: DocumentSummary[] = [];
  const linked: DocumentSummary[] = [];
  let used = 0;
  for (const d of documents) {
    if (used + d.size <= budget) {
      attached.push(d);
      used += d.size;
    } else {
      linked.push(d);
    }
  }
  return { ok: true, documents, attached, linked, totalBytes: documents.reduce((sum, d) => sum + d.size, 0) };
}

/** Checks an upload before it is stored. Returns the error to show, or null. */
export function validateUpload(input: { size: number; mimeType: string; filename: string }): string | null {
  if (input.size <= 0) return "Le fichier est vide.";
  if (input.size > MAX_FILE_BYTES) return `Le fichier dépasse ${formatBytes(MAX_FILE_BYTES)}.`;
  if (!ALLOWED_MIME_TYPES[input.mimeType]) return "Format accepté : PDF, Word, PowerPoint, Excel, ZIP, PNG ou JPG.";
  if (!input.filename.trim()) return "Le fichier n'a pas de nom.";
  return null;
}

/**
 * "• Programme des 15 jours (PDF, 1,2 Mo)" per line, as the template's
 * {{liste_documents}}; a linked document carries its download link.
 */
export function documentList(documents: DocumentSummary[], links: Record<number, string> = {}): string {
  return documents
    .map((d) => {
      const line = `• ${d.name} (${extension(d.filename).toUpperCase()}, ${formatBytes(d.size)})`;
      return links[d.id] ? `${line} : à télécharger ici ${links[d.id]}` : line;
    })
    .join("\n");
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

/** A blob pathname for an upload: a folder per programme, a random prefix, the safe file name. */
export function blobPathnameFor(program: string, filename: string, random: string): string {
  const safe = safeFilename(filename).replace(/[^\w.\-]+/g, "-").slice(-120);
  return `documents/${program}/${random}-${safe}`;
}
