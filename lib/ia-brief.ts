/**
 * Bâtisseur IA project sheet (Ben, 04/11/2026): what the participant wants
 * to build, filled on their calendar page before J1 so Ben knows each
 * project on the first morning. Labels only (client-safe); validation in
 * lib/ia-brief-schema.ts.
 */

export const BRIEF_FIELDS = [
  { key: "business", label: "Votre activité, en une phrase", hint: "Ex. : cabinet de formation en gestion, 3 personnes, à Douala.", rows: 2, max: 400, required: true },
  { key: "users", label: "Qui utilisera votre système ?", hint: "Vous, votre équipe, vos clients, vos partenaires…", rows: 2, max: 400, required: true },
  { key: "tasks", label: "Les trois tâches qu’elle doit faire en premier", hint: "Ex. : relancer les prospects, faire les devis, savoir qui a payé.", rows: 4, max: 800, required: true },
  { key: "data", label: "Vos données aujourd’hui, et où elles sont", hint: "Clients, devis, stock, rendez-vous… dans Excel, WhatsApp, un cahier, un logiciel.", rows: 3, max: 800, required: true },
  { key: "inspiration", label: "Une application ou un site que vous aimez (facultatif)", hint: "Un lien ou un nom, pour l’allure ou le fonctionnement.", rows: 2, max: 400, required: false },
  { key: "domain", label: "Le nom de domaine souhaité (facultatif)", hint: "Ex. : mon-cabinet.com. On le relie ensemble à la J2.", rows: 1, max: 120, required: false },
] as const;

export type BriefKey = (typeof BRIEF_FIELDS)[number]["key"];

export const PAYMENTS = {
  none: "Pas d’encaissement en ligne pour l’instant",
  card: "Carte bancaire",
  mobile: "Mobile money",
  both: "Carte et mobile money",
} as const;
export type PaymentChoice = keyof typeof PAYMENTS;

export type Brief = Record<BriefKey, string> & { payments: PaymentChoice };

/** "Activité : … / Utilisateurs : …" for Ben's e-mail and the admin. */
export function briefLines(brief: Brief): string[] {
  const short: Record<BriefKey, string> = { business: "Activité", users: "Utilisateurs", tasks: "Trois tâches", data: "Données", inspiration: "Inspiration", domain: "Domaine" };
  return [
    ...BRIEF_FIELDS.filter((f) => brief[f.key]?.trim()).map((f) => `${short[f.key]} : ${brief[f.key].trim()}`),
    `Encaissement : ${PAYMENTS[brief.payments]}`,
  ];
}
