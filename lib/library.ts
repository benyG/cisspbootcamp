import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { Marked } from "marked";

/**
 * The library (Ben, 24/11): every document Claude writes for the business
 * (operating guide, programme, participants' sheets, offer studies) lives in
 * the repository as Markdown under content/library and is read here, so the
 * application keeps them and every correction is versioned. Files Ben brings
 * himself (slides, trainer files) are uploads, see lib/documents.ts.
 */

export const LIBRARY_CATEGORIES = {
  exploitation: "Exploitation et pilotage",
  "ia-formateur": "Bâtisseur IA · formateur",
  "ia-participants": "Bâtisseur IA · participants",
  entreprises: "Bâtisseur IA Entreprises",
} as const;
export type LibraryCategory = keyof typeof LIBRARY_CATEGORIES;

/** internal: Ben only; participants: may be shared with participants (public link). */
export type LibraryAudience = "internal" | "participants";

export type LibraryDoc = {
  slug: string;
  title: string;
  category: LibraryCategory;
  audience: LibraryAudience;
  updated: string;
  summary: string;
  body: string;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIR = () => path.join(process.cwd(), "content", "library");

/** "---\nkey: value\n---\nbody" → fields and body. Pure. */
export function parseDocument(slug: string, raw: string): LibraryDoc | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match || !SLUG.test(slug)) return null;
  const fields: Record<string, string> = {};
  for (const line of match[1]!.split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const category = fields.category as LibraryCategory;
  if (!fields.title || !(category in LIBRARY_CATEGORIES)) return null;
  return {
    slug,
    title: fields.title,
    category,
    audience: fields.audience === "participants" ? "participants" : "internal",
    updated: /^\d{4}-\d{2}-\d{2}$/.test(fields.updated ?? "") ? fields.updated! : "",
    summary: fields.summary ?? "",
    body: match[2]!.trim(),
  };
}

export function listLibrary(): LibraryDoc[] {
  let files: string[] = [];
  try {
    files = readdirSync(DIR()).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  return files
    .map((f) => parseDocument(f.slice(0, -3), readFileSync(path.join(DIR(), f), "utf8")))
    .filter((d): d is LibraryDoc => d !== null)
    .sort((a, b) => Object.keys(LIBRARY_CATEGORIES).indexOf(a.category) - Object.keys(LIBRARY_CATEGORIES).indexOf(b.category) || a.title.localeCompare(b.title, "fr"));
}

export function getLibraryDoc(slug: string): LibraryDoc | null {
  if (!SLUG.test(slug)) return null;
  try {
    return parseDocument(slug, readFileSync(path.join(DIR(), `${slug}.md`), "utf8"));
  } catch {
    return null;
  }
}

const marked = new Marked({ gfm: true, breaks: false });
marked.use({
  renderer: {
    // External links open in a new tab; links inside the app stay in place.
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:\/\//.test(href);
      const t = title ? ` title="${escapeAttr(title)}"` : "";
      return `<a href="${escapeAttr(href)}"${t}${external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${text}</a>`;
    },
  },
});

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Markdown from the repository (trusted content, written by us) → HTML. */
export function renderMarkdown(body: string): string {
  return marked.parse(body, { async: false }) as string;
}

export const formatUpdated = (iso: string) => (iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "");
