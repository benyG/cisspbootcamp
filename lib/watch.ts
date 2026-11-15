/**
 * The weekly market watch (lot D): what competitors and the market did
 * this week, for the Monday report. Pure: the prompt, the parsing, and the
 * rule that keeps only items whose link came out of the web search itself,
 * so nothing is invented.
 */

export type WatchItem = { title: string; url: string; why: string };

export const WATCH_SYSTEM = [
  "Tu fais la veille concurrentielle hebdomadaire de deux offres de formation en français :",
  "1) CISSP Bootcamp : préparation en ligne aux certifications CISSP et CC d’ISC², pour des francophones, surtout en Afrique de l’Ouest et centrale ;",
  "2) Bâtisseur IA : formation pour entrepreneurs non développeurs qui bâtissent leur entreprise autonome avec Claude Code.",
  "Cherche sur le web ce qui a changé ces 7 derniers jours : nouvelles offres ou promotions de formations concurrentes en français, changements d’ISC² (examen, prix, règles), nouveautés importantes de Claude ou des outils no-code utiles aux entrepreneurs.",
  "Règles : uniquement des faits trouvés dans tes recherches, chacun avec son lien exact. Aucune estimation, aucun chiffre sans source. Si rien de neuf, réponds « RIEN ».",
  "Format : une ligne par point, au plus 6, exactement :",
  "Titre court || URL || Ce que ça change pour nous, en une phrase",
].join("\n");

export function parseWatch(text: string, searchedUrls: ReadonlySet<string>): WatchItem[] {
  const norm = (u: string) => u.trim().replace(/[).,;]+$/, "").replace(/\/$/, "");
  const allowed = new Set([...searchedUrls].map(norm));
  return text
    .split("\n")
    .map((line) => line.split("||").map((p) => p.trim()))
    .filter((p) => p.length >= 3 && /^https?:\/\//.test(p[1]!) && allowed.has(norm(p[1]!)))
    .map(([title, url, why]) => ({ title: title!.replace(/^[-*•\d.\s]+/, "").slice(0, 160), url: norm(url!).slice(0, 500), why: why!.slice(0, 300) }))
    .slice(0, 6);
}

/** The Monday report's lines. */
export function watchParagraph(items: readonly WatchItem[]): string[] {
  if (!items.length) return [];
  return ["Veille du marché (sources vérifiées par la recherche) :", ...items.map((i) => `- ${i.title} : ${i.why} (${i.url})`), ""];
}
