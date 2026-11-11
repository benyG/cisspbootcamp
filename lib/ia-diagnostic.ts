/**
 * Bâtisseur IA autonomy diagnostic (Ben, 03/11/2026; reframed 08/11 on the
 * autonomous business: where the business stands, and the first tasks to put
 * on autopilot, for an existing activity or a project). Pure and rule-based,
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
  produit: "Un projet d’entreprise, pas encore lancé",
} as const;

/**
 * The tasks that take time, in the order the result ranks them (most
 * effect on revenue first), with what the application does instead and the
 * journée where it is built.
 */
export const TASKS = {
  relance: { label: "Relancer les prospects", title: "Relancer vos prospects sans y penser", how: "J4 et J6 : un agent qui relance seul, puis les routines du pilotage" },
  paiements: { label: "Suivre les paiements", title: "Savoir qui a payé, sans chercher", how: "J3 et J4 : tableau de bord et paiement en ligne" },
  devis: { label: "Faire les devis et les factures", title: "Devis et factures en un clic", how: "J4 : devis, factures et reçus en PDF, préparés par un agent" },
  rdv: { label: "Gérer les rendez-vous", title: "Des rendez-vous pris sans aller-retour", how: "J4 : l’agent vente propose les créneaux et rappelle le rendez-vous" },
  chiffres: { label: "Préparer les chiffres du mois", title: "Les chiffres du mois, prêts le 1er", how: "J3 et J6 : tableau de bord, puis un rapport chaque semaine et un agent analyste" },
  questions: { label: "Répondre aux mêmes questions", title: "Répondre aux questions fréquentes", how: "J1 et J5 : un agent service client qui répond depuis vos documents" },
  seo: { label: "Être trouvé sur Google", title: "Être trouvé par vos clients sur Google", how: "J5 : un agent de veille : référencement, mots-clés, concurrents" },
  reseaux: { label: "Publier sur les réseaux", title: "Préparer vos publications", how: "J5 : un agent communication : publications et images, que vous validez" },
  livraisons: { label: "Organiser production et livraisons", title: "Production et livraisons planifiées", how: "J5 : un agent opérations : planning, stock, livraisons, selon votre activité" },
  administratif: { label: "Comptabilité et échéances", title: "Pièces comptables et échéances à jour", how: "J6 : un agent administratif : pièces rangées, échéances rappelées, données personnelles suivies" },
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
  excel: "Vos fichiers Excel ou Google Sheets servent de point de départ : leurs données sont reprises dans votre système à la J3.",
  whatsapp: "Vos échanges WhatsApp et votre cahier deviennent des fiches clients rangées, dès la J3.",
  logiciel: "Votre système complète votre logiciel de gestion ; si celui-ci le permet, on les relie à la J6, avec un agent IA.",
  rien: "On part d’une page blanche : c’est le cas le plus simple, tout est rangé dès la J3.",
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

/** Where the business stands today (Ben, 08/11): from the tools it runs on, or a project. */
export type AutonomyLevel = "project" | "manual" | "assisted";
export const AUTONOMY: Record<AutonomyLevel, { label: string; text: string }> = {
  project: { label: "Projet", text: "Votre entreprise peut démarrer directement en pilote automatique : vous construisez le système avant le premier client." },
  manual: { label: "Manuel", text: "Aujourd’hui, tout passe par vous : rien ne part, ne se relance ni ne se compte sans vous. Prochaine marche : un système qui agit selon vos règles." },
  assisted: { label: "Assisté", text: "Un logiciel enregistre, mais c’est vous qui relancez, comptez et publiez. Prochaine marche : qu’il agisse seul selon vos règles." },
};

export function autonomyLevel(answers: Pick<IaAnswers, "activity" | "tools">): AutonomyLevel {
  if (answers.activity === "produit") return "project";
  return answers.tools === "logiciel" ? "assisted" : "manual";
}

export type IaDiagnosis = {
  autonomy: AutonomyLevel;
  project: boolean;
  ready: boolean;
  hoursPhrase: string;
  priorities: Array<{ code: TaskCode; title: string; how: string }>;
  toolsNote: string;
};

/** The result: the autonomy level, ready or to prepare, the tasks to put on autopilot first, where to start from. */
export function diagnose(answers: IaAnswers): IaDiagnosis {
  const order = Object.keys(TASKS) as TaskCode[];
  const picked = order.filter((code) => answers.tasks.includes(code)).slice(0, PRIORITY_COUNT);
  return {
    autonomy: autonomyLevel(answers),
    project: answers.activity === "produit",
    ready: Number(answers.ease) >= READY_EASE,
    hoursPhrase: HOURS_PHRASE[answers.hours],
    priorities: picked.map((code) => ({ code, title: TASKS[code].title, how: TASKS[code].how })),
    toolsNote: TOOLS_NOTE[answers.tools],
  };
}

/** One line for Ben: "TPE · 5 à 10 h par semaine · … · aisance 2/4 (séance d’accueil)". */
export function diagnosisSummary(answers: IaAnswers): string {
  const d = diagnose(answers);
  return [ACTIVITIES[answers.activity].split(" :")[0], `${d.hoursPhrase} par semaine`, answers.tasks.map((t) => TASKS[t].label.toLowerCase()).join(", "), `outils : ${TOOLS[answers.tools]}`, `aisance ${answers.ease}/4 (${d.ready ? "démarrage direct" : "séance d’accueil"})`, `autonomie : ${AUTONOMY[d.autonomy].label}`].join(" · ");
}
