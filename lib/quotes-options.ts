/** Company quote options (Ben, 21/10): shared by the public form and the server. No I/O. */

/** Below this many people, the individual registration is enough. */
export const MIN_TEAM = 3;
/** The answer time promised on the page and in the confirmation. */
export const ANSWER_DELAY = "48 h ouvrées";

export const CERTIFICATIONS = { cissp: "CISSP", cc: "CC (débutants)", both: "Les deux / à définir" } as const;
export const FORMATS = { onsite: "Sur site", online: "En ligne", mixed: "Mixte" } as const;
export const HEADCOUNTS = { "3-5": "3 à 5", "6-10": "6 à 10", "11-20": "11 à 20", "20+": "Plus de 20" } as const;
export const TIMINGS = { "3m": "Dans les 3 mois", "6m": "3 à 6 mois", later: "Plus tard / à définir" } as const;
export const STATUSES = { new: "Nouvelle", sent: "Devis envoyé", won: "Gagné", lost: "Perdu" } as const;
export type QuoteStatus = keyof typeof STATUSES;
