/**
 * Copy of the Bâtisseur IA landing page (Ben, 05/11, from the validated
 * prototype): what a participant writes and learns each journée, the day's
 * timetable, what our own site runs alone as proof (Ben, 08/11: the
 * autonomous business), the questions people ask. Facts only.
 */

/** Per journée, beside JOURNEES (lib/ia-days.ts): a tab label, the example prompt, the skills. */
export const DAY_DEMO: ReadonlyArray<{ short: string; prompt: string; skills: readonly string[] }> = [
  { short: "En ligne", prompt: "Crée le site de mon atelier de couture avec une page de prise de rendez-vous, et mets-le en ligne sur mon nom de domaine.", skills: ["Mettre une application en ligne", "Décrire une page à Claude Code et la corriger", "Sauvegarder votre code sur GitHub"] },
  { short: "Cœur métier", prompt: "Ajoute la liste de mes clientes avec leurs mesures, l’état de chaque commande et le tableau de bord du mois.", skills: ["Créer votre base de données et vos écrans", "Construire votre tableau de bord", "Faire tester chaque changement"] },
  { short: "Vendre", prompt: "Ajoute un acompte par Orange Money ou carte, la facture en PDF, et relance un devis resté trois jours sans réponse.", skills: ["Brancher le paiement mobile money et carte", "Produire devis, factures et reçus en PDF", "Programmer des relances par e-mail"] },
  { short: "Communiquer", prompt: "Chaque semaine, propose-moi trois publications LinkedIn et Facebook sur mes nouveaux modèles, avec leur image.", skills: ["Générer des publications à votre ton", "Créer leurs images automatiquement", "Tout valider avant publication"] },
  { short: "Marché", prompt: "Analyse les recherches sur la couture sur mesure à Lomé et ce que publient mes concurrents, puis propose-moi un plan de contenu.", skills: ["Améliorer le référencement de votre site", "Collecter mots-clés et pages des concurrents", "Tirer un plan de contenu de ces données"] },
  { short: "Agent IA", prompt: "Branche un agent sur ma base en lecture seule : chaque lundi, il me dit quelles clientes relancer et quels modèles se vendent.", skills: ["Ouvrir vos données à un agent avec MCP", "Programmer des analyses automatiques", "Poser des garde-fous : lecture seule, rien ne part sans vous"] },
];

/**
 * A training day, in minutes from the start (10 h Montréal by default): 5 h
 * of teaching and 1 h of pause, as lib/ia-days.ts counts them. Validated by Ben (05/11).
 */
export const DAY_PLAN: ReadonlyArray<{ at: number; title: string; text: string; kind: "show" | "you" | "pause" | "review" }> = [
  { at: 0, title: "Démonstration", text: "L’étape du jour est construite en direct, sur un projet d’exemple.", kind: "show" },
  { at: 45, title: "Vous construisez", text: "Même étape, sur votre projet. On passe d’un écran à l’autre pour vous débloquer.", kind: "you" },
  { at: 150, title: "Pause", text: "1 heure.", kind: "pause" },
  { at: 210, title: "Vous construisez", text: "Vous terminez, vous testez, vous mettez en route.", kind: "you" },
  { at: 315, title: "Revue en groupe", text: "Chacun montre ce qui tourne. Ce qui bloque se règle ensemble.", kind: "review" },
];

/** What this site runs alone, and what it leaves to us (lots 2 to 8 of docs/PILOTAGE.md): facts only. */
export const SITE_RUNS: { alone: readonly string[]; ours: readonly string[] } = {
  alone: [
    "Suit chaque cohorte face à son objectif.",
    "Relance les paiements commencés.",
    "Prévient d’un retard, avec un plan de rattrapage.",
    "Écrit les publications et le rapport du lundi.",
  ],
  ours: ["Les prix et les dates.", "Chaque publication, relue.", "Les appels."],
};

/** The definition we quote (Ben, 08/11): Gartner's public article, paraphrased in French and linked. No forecast figure. */
export const GARTNER = {
  text: "Gartner la décrit comme une entreprise qui s’appuie sur une technologie capable d’apprendre pour décider, agir et créer de la valeur, en donnant plus d’autonomie aux machines et aux personnes.",
  source: "Gartner, « Autonomous Business Is Coming, Powered by AI »",
  url: "https://www.gartner.com/en/articles/what-is-autonomous-business",
} as const;

export const AUTONOMY_LEVELS: ReadonlyArray<{ name: string; text: string }> = [
  { name: "Manuel", text: "Vous faites tout." },
  { name: "Assisté", text: "Il prépare, vous validez." },
  { name: "Autonome", text: "Il agit selon vos règles." },
];

export const IA_FAQ: ReadonlyArray<{ q: string; a: string }> = [
  { q: "Une entreprise sans humains ?", a: "Non. Les tâches qui reviennent tournent seules, selon vos règles. Les décisions, les prix et tout ce qui est public restent à vous." },
  { q: "Je n’ai pas encore d’entreprise.", a: "Venez avec votre projet. Vous construisez le système autour de votre offre : votre entreprise démarre déjà organisée." },
  { q: "Je ne sais pas coder.", a: "C’est prévu. Vous décrivez en français, Claude Code écrit le code, vous vérifiez à l’écran. Une séance d’accueil d’une heure installe tout avec vous avant la J1 si besoin." },
  { q: "Construisez-vous le système pour moi ?", a: "Non : c’est une formation. Vous le construisez vous-même, en direct. À la fin, il est à vous et vous savez le faire évoluer." },
  { q: "Je ne suis pas libre tous les week-ends.", a: "Vous entrez par une J1, puis vous choisissez vos J2 à J6 parmi les samedis et dimanches suivants." },
];
