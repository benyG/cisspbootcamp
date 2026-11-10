/**
 * Copy of the Bâtisseur IA landing page (Ben, 05/11, from the validated
 * prototype): what a participant writes and learns each journée, the day's
 * timetable, what our own site runs alone as proof (Ben, 08/11: the
 * autonomous business), the questions people ask. Facts only.
 */

/** Per journée, beside JOURNEES (lib/ia-days.ts): a tab label and what the participant knows afterwards. */
export const DAY_DEMO: ReadonlyArray<{ short: string; skills: readonly string[] }> = [
  { short: "Composantes de l’IA", skills: ["Comprendre modèle, prompt, contexte et RAG", "Créer une skill et un assistant sur vos documents", "Relier l’IA à vos outils (MCP)"] },
  { short: "Processus et fondations", skills: ["Cartographier vos processus métiers", "Choisir ce qui s’automatise en premier", "Mettre en ligne avec Claude Code, GitHub et Vercel"] },
  { short: "Activité et données", skills: ["Structurer clients, commandes et factures", "Créer votre base et vos écrans", "Construire votre tableau de bord, testé"] },
  { short: "Système d’agents", skills: ["Construire des agents qui agissent", "Encaisser par carte et mobile money", "Fixer leurs règles et leurs limites"] },
  { short: "Agents spécialisés", skills: ["Un agent communication, que vous validez", "Un agent de veille du marché", "Les interfaces pour travailler avec eux"] },
  { short: "Pilotage autonome", skills: ["Fixer des objectifs et leur courbe cible", "Programmer des routines qui relancent et alertent", "Brancher un agent IA analyste, avec vos garde-fous"] },
];

/**
 * The two example projects of the programme (Ben, 08/11: both audiences),
 * fictitious and said so: an existing workshop, a business that starts.
 * What each asks the AI, journée by journée (programme of 10/11).
 */
export type ExampleKey = "adjoa" | "kofi";
export const EXAMPLES: Record<ExampleKey, { tab: string; note: string; prompts: readonly string[] }> = {
  adjoa: {
    tab: "Adjoa · atelier existant",
    note: "Atelier Adjoa : activité existante, exemple fictif.",
    prompts: [
      "Lis mes tarifs et mes modèles, puis réponds aux questions de mes clientes comme je le ferais.",
      "Voici comment je reçois, mesure et livre une commande : dis-moi quoi automatiser d’abord, et mets mon atelier en ligne à mon nom de domaine.",
      "Ajoute mes clientes avec leurs mesures, l’état de chaque commande et le tableau de bord du mois.",
      "Quand une cliente demande un devis, prépare-le, encaisse l’acompte par Orange Money ou carte, et relance-la après trois jours sans réponse.",
      "Chaque semaine, propose-moi trois publications sur mes nouveaux modèles, avec leur image, et dis-moi ce que publient mes concurrentes.",
      "Chaque lundi, dis-moi si je suis en avance sur mes 20 commandes du mois et prépare les relances des clientes silencieuses.",
    ],
  },
  kofi: {
    tab: "Kofi · traiteur qui démarre",
    note: "Kofi Traiteur : entreprise qui démarre, exemple fictif.",
    prompts: [
      "À partir de mes menus et de mes prix, réponds aux demandes des entreprises comme je le ferais.",
      "Voici le circuit d’une commande, de la demande à la livraison : dis-moi quoi automatiser d’abord, et mets ma page en ligne.",
      "Ajoute mes clients, les commandes de la semaine, les quantités à acheter et le tableau de bord du mois.",
      "Prépare le devis en PDF, encaisse l’acompte par mobile money et relance l’entreprise qui n’a pas répondu.",
      "Chaque lundi, propose-moi le menu de la semaine en publication LinkedIn, avec sa photo, et dis-moi ce que proposent mes concurrents.",
      "Si je suis en retard sur mes 8 contrats du trimestre, propose-moi un plan de rattrapage et attends mon accord.",
    ],
  },
};

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
