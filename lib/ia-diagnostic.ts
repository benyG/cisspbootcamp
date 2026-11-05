/**
 * Bâtisseur IA automation diagnostic (Ben, 03/11/2026). Pure and rule-based,
 * like the CISSP scanner: no AI, no promised gain. Ben tunes the constants
 * below. No zod here: the questionnaire imports these labels in the browser
 * (validation lives in lib/ia-diagnostic-schema.ts).
 */

/** Computer ease (1 to 4) from which a person starts without the reinforced onboarding session. */
export const READY_EASE = 3;
/** How many automations the result puts forward. */
export const PRIORITY_COUNT = 3;

export const ACTIVITIES = {
  solo: "À votre compte : conseil, formation, coaching",
  tpe: "TPE : de 1 à 10 personnes",
  pme: "PME : plus de 10 personnes",
  produit: "Un projet de produit",
} as const;

/**
 * The tasks that take time, in the order the result ranks them (most
 * effect on revenue first), with what the application does instead and the
 * journée where it is built.
 */
export const TASKS = {
  relance: { label: "Relancer les prospects", title: "Relancer vos prospects sans y penser", how: "J3 et J6 : formulaire, e-mails, agent qui prépare les relances" },
  paiements: { label: "Suivre les paiements", title: "Savoir qui a payé, sans chercher", how: "J2 et J3 : tableau de bord et paiement en ligne" },
  devis: { label: "Faire les devis et les factures", title: "Devis et factures en un clic", how: "J3 : devis, factures et reçus en PDF" },
  rdv: { label: "Gérer les rendez-vous", title: "Des rendez-vous pris sans aller-retour", how: "J3 : réservation en ligne et rappels" },
  chiffres: { label: "Préparer les chiffres du mois", title: "Les chiffres du mois, prêts le 1er", how: "J2 et J6 : tableau de bord, puis un agent qui analyse vos chiffres" },
  questions: { label: "Répondre aux mêmes questions", title: "Répondre aux questions fréquentes", how: "J6 : un agent qui répond depuis vos documents et vos données" },
  seo: { label: "Être trouvé sur Google", title: "Être trouvé par vos clients sur Google", how: "J5 : référencement, mots-clés et analyse des concurrents" },
  reseaux: { label: "Publier sur les réseaux", title: "Préparer vos publications", how: "J4 : publications Facebook et LinkedIn avec leurs images, que vous validez" },
} as const;

export const HOURS = { "2": "Moins de 2 h", "5": "De 2 à 5 h", "10": "De 5 à 10 h", "11": "Plus de 10 h" } as const;
const HOURS_PHRASE: Record<keyof typeof HOURS, string> = { "2": "moins de 2 h", "5": "2 à 5 h", "10": "5 à 10 h", "11": "plus de 10 h" };

export const TOOLS = {
  excel: "Excel ou Google Sheets",
  whatsapp: "WhatsApp et un cahier",
  logiciel: "Un logiciel de gestion",
  rien: "Rien d’organisé",
} as const;
const TOOLS_NOTE: Record<keyof typeof TOOLS, string> = {
  excel: "Vos fichiers Excel ou Google Sheets servent de point de départ : leurs données sont reprises dans votre application à la J2.",
  whatsapp: "Vos échanges WhatsApp et votre cahier deviennent des fiches clients rangées, dès la J2.",
  logiciel: "Votre application complète votre logiciel de gestion ; si celui-ci le permet, on les relie à la J6, avec un agent IA.",
  rien: "On part d’une page blanche : c’est le cas le plus simple, tout est rangé dès la J2.",
};

export const EASE = {
  "1": "J’ai besoin d’aide",
  "2": "Avec un tutoriel",
  "3": "Sans difficulté",
  "4": "Je dépanne les autres",
} as const;

export type IaAnswers = {
  activity: keyof typeof ACTIVITIES;
  tasks: Array<keyof typeof TASKS>;
  hours: keyof typeof HOURS;
  tools: keyof typeof TOOLS;
  ease: keyof typeof EASE;
};
export type TaskCode = keyof typeof TASKS;

export type IaDiagnosis = {
  ready: boolean;
  hoursPhrase: string;
  priorities: Array<{ code: TaskCode; title: string; how: string }>;
  toolsNote: string;
};

/** The result: ready or to prepare, the automations to build first, where to start from. */
export function diagnose(answers: IaAnswers): IaDiagnosis {
  const order = Object.keys(TASKS) as TaskCode[];
  const picked = order.filter((code) => answers.tasks.includes(code)).slice(0, PRIORITY_COUNT);
  return {
    ready: Number(answers.ease) >= READY_EASE,
    hoursPhrase: HOURS_PHRASE[answers.hours],
    priorities: picked.map((code) => ({ code, title: TASKS[code].title, how: TASKS[code].how })),
    toolsNote: TOOLS_NOTE[answers.tools],
  };
}

/** One line for Ben: "TPE · 5 à 10 h par semaine · … · aisance 2/4 (séance d’accueil)". */
export function diagnosisSummary(answers: IaAnswers): string {
  const d = diagnose(answers);
  return [ACTIVITIES[answers.activity].split(" :")[0], `${d.hoursPhrase} par semaine`, answers.tasks.map((t) => TASKS[t].label.toLowerCase()).join(", "), `outils : ${TOOLS[answers.tools]}`, `aisance ${answers.ease}/4 (${d.ready ? "démarrage direct" : "séance d’accueil"})`].join(" · ");
}
