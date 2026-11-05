import localFont from "next/font/local";

/**
 * Bâtisseur IA's own faces (Ben, 05/11): a condensed display for the
 * headings, a plain body, a mono for prompts and labels. Latin subsets
 * served from our domain (no request to Google), as for the CISSP site.
 * All three are under the SIL Open Font License.
 */
export const iaDisplay = localFont({ src: "../../fonts/barlow-condensed-800-latin.woff2", weight: "800", display: "swap", variable: "--font-ia-display" });

export const iaBody = localFont({
  src: [
    { path: "../../fonts/barlow-400-latin.woff2", weight: "400", style: "normal" },
    { path: "../../fonts/barlow-600-latin.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-ia-body",
});

export const iaMono = localFont({ src: "../../fonts/jetbrains-mono-latin.woff2", weight: "400 600", display: "swap", variable: "--font-ia-mono", preload: false });

export const iaFontVariables = `${iaDisplay.variable} ${iaBody.variable} ${iaMono.variable}`;
