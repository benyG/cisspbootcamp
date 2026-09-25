/**
 * The CISSP reading plan (Ben, 25/09): 15 days, 40 hours of live sessions, the
 * eight official domains, and what to read in the Sybex Official Study Guide
 * before each session. The page itself is lib/reading-plan/template.html;
 * this is its data. Reading times are estimates and drive the page's agenda.
 */

export type ReadingKind = "full" | "only" | "except" | "range" | "review";
export type Reading = { ch: number; kind: ReadingKind; text: string; min: number };
/** d: the domain (0 for the closing review), h: hours spent on it in the session. */
export type Session = { n: number; hours: number; blocks: Array<{ d: number; h: number }>; title: string; goal: string; read: Reading[]; todo?: string; rest?: boolean };

/** Official ISC² exam weights, in percent. */
export const DOMAINS: Record<number, { name: string; weight: number }> = {
  1: { name: "Sécurité et gestion des risques", weight: 16 },
  2: { name: "Sécurité des actifs", weight: 10 },
  3: { name: "Architecture et ingénierie de sécurité", weight: 13 },
  4: { name: "Sécurité des communications et des réseaux", weight: 13 },
  5: { name: "Gestion des identités et des accès (IAM)", weight: 13 },
  6: { name: "Évaluation et tests de sécurité", weight: 12 },
  7: { name: "Opérations de sécurité", weight: 13 },
  8: { name: "Sécurité du développement logiciel", weight: 10 },
};

/** Estimated reading minutes by kind of reading. */
export const READING_MINUTES: Record<ReadingKind, number> = { full: 90, range: 50, only: 35, except: 75, review: 20 };

function read(ch: number, kind: ReadingKind, text = "", min = READING_MINUTES[kind]): Reading {
  return { ch, kind, text, min };
}

/** A Wednesday without a live session (Ben, 25/09): rest, and time to read ahead. */
function restDay(n: number): Session {
  return { n, hours: 0, blocks: [], rest: true, title: "Journée repos lecture", goal: "Pas de session en ligne aujourd’hui. Reposez-vous, puis avancez vos lectures : c’est le jour pour prendre de l’avance sur les prochaines sessions.", read: [] };
}

/**
 * One entry per calendar day, J1 a Monday. Evenings 2 h, Wednesdays off,
 * weekend days 5 h 30 (Ben, 25/09): 9 × 2 h + 4 × 5 h 30 = 40 h.
 */
export const SESSIONS: Session[] = [
  {
    n: 1,
    hours: 2,
    blocks: [{ d: 1, h: 2 }],
    title: "Gouvernance, éthique et sécurité du personnel",
    goal: "Poser le cadre du manager : gouvernance, rôles, politiques, code d’éthique ISC².",
    read: [read(19, "only", "Ethics"), read(1, "except", "Threat Modeling, vu en J2"), read(2, "only", "Personnel Security Policies")],
  },
  {
    n: 2,
    hours: 2,
    blocks: [{ d: 1, h: 2 }],
    title: "Gestion des risques et modélisation des menaces",
    goal: "Raisonner en risque : analyse, traitement, contrôles, modélisation des menaces.",
    read: [read(2, "except", "Personnel Security Policies (lu pour J1) et Social Engineering (J13)"), read(1, "only", "Threat Modeling")],
  },
  restDay(3),
  {
    n: 4,
    hours: 2,
    blocks: [{ d: 1, h: 2 }],
    title: "Lois, conformité et continuité d’activité",
    goal: "Cadres légaux, propriété intellectuelle, vie privée, puis le plan de continuité (PCA).",
    read: [read(4, "full"), read(3, "full")],
  },
  {
    n: 5,
    hours: 2,
    blocks: [{ d: 2, h: 2 }],
    title: "Classification et cycle de vie des actifs",
    goal: "Classer, détenir, conserver et éliminer l’information ; provisionner les ressources.",
    read: [read(5, "except", "Data Protection Methods, lu pour J6"), read(16, "only", "Provision Resources Securely")],
  },
  {
    n: 6,
    hours: 5.5,
    blocks: [{ d: 2, h: 2 }, { d: 3, h: 3.5 }],
    title: "Protection des données, atelier D1-D2, puis principes et cryptographie",
    goal: "Méthodes de protection des données et 45 minutes de questions corrigées sur les domaines 1 et 2 ; puis principes de conception sûre, modèles de sécurité, vulnérabilités des architectures, cryptographie symétrique.",
    read: [read(5, "only", "Data Protection Methods"), read(8, "full"), read(9, "full"), read(6, "full")],
  },
  {
    n: 7,
    hours: 5.5,
    blocks: [{ d: 3, h: 3.5 }, { d: 4, h: 2 }],
    title: "PKI, sécurité physique, puis architecture réseau",
    goal: "Asymétrique, PKI, sécurité physique et cloud ; puis modèles OSI et TCP/IP.",
    read: [read(7, "full"), read(10, "full"), read(16, "only", "Separation of Duties · Manage Services in the Cloud"), read(11, "range", "Du début jusqu’à « Wireless Networks »")],
  },
  {
    n: 8,
    hours: 2,
    blocks: [{ d: 4, h: 2 }],
    title: "Sans-fil et technologies réseau",
    goal: "Réseaux sans fil, composants réseau, commutation, WAN, NAT, supports de transmission.",
    read: [read(11, "range", "De « Wireless Networks » jusqu’à la fin"), read(12, "only", "Switching Technologies · WAN Technologies · NAT · Cabling and Transmission Media · Fiber-Optic Links")],
  },
  {
    n: 9,
    hours: 2,
    blocks: [{ d: 4, h: 1 }, { d: 5, h: 1 }],
    title: "Communications sécurisées, puis identité",
    goal: "VLAN, VPN, messagerie, accès distant, voix, SDN ; puis les fondamentaux de l’identité.",
    read: [
      read(12, "only", "Secure Network Components · Switching and Virtual LANs · Virtual Private Network · Manage Email Security · Remote Access Security Management · Secure Voice Communications · Software-Defined Networking", 60),
      read(13, "range", "Du début jusqu’à « Implementing Identity Management »"),
    ],
  },
  restDay(10),
  {
    n: 11,
    hours: 2,
    blocks: [{ d: 5, h: 2 }],
    title: "Gestion des identités et authentification",
    goal: "Cycle de vie des identités, fédération, modèles de contrôle d’accès.",
    read: [read(13, "range", "Le reste, à partir de « Implementing Identity Management »"), read(14, "range", "Du début jusqu’à « Implementing Authentication Systems »")],
  },
  {
    n: 12,
    hours: 2,
    blocks: [{ d: 5, h: 1 }, { d: 6, h: 1 }],
    title: "Systèmes d’authentification, puis évaluation",
    goal: "Kerberos, SSO, attaques sur l’accès ; puis stratégies d’évaluation et d’audit.",
    read: [read(14, "range", "Le reste, à partir de « Implementing Authentication Systems »"), read(15, "range", "Du début jusqu’à « Testing Your Software »")],
  },
  {
    n: 13,
    hours: 5.5,
    blocks: [{ d: 6, h: 3.5 }, { d: 7, h: 2 }],
    title: "Tests, sensibilisation, atelier audit, puis opérations",
    goal: "Tests de code et d’application, indicateurs, ingénierie sociale et sensibilisation, scénarios d’audit corrigés ; puis opérations de sécurité et gestion des incidents.",
    read: [
      read(15, "range", "Le reste, à partir de « Testing Your Software »"),
      read(2, "only", "Social Engineering · Security Awareness"),
      read(16, "except", "Provision Resources Securely · Separation of Duties · Manage Services in the Cloud, déjà lus"),
      read(17, "full"),
    ],
  },
  {
    n: 14,
    hours: 5.5,
    blocks: [{ d: 7, h: 2.5 }, { d: 8, h: 3 }],
    title: "Reprise après sinistre, enquêtes, puis développement sûr",
    goal: "PRA, enquêtes et preuves ; puis cycle de développement, bases de données, attaques applicatives.",
    read: [read(18, "full"), read(19, "except", "Ethics, lu pour J1"), read(20, "full"), read(21, "full")],
  },
  {
    n: 15,
    hours: 2,
    blocks: [{ d: 0, h: 2 }],
    title: "Bilan : examen blanc corrigé et plan jusqu’à l’examen",
    goal: "Correction de l’examen blanc, stratégie du format adaptatif, plan de révision daté jusqu’à votre examen.",
    read: [],
    todo: "Passer l’examen blanc envoyé par Ben, en conditions réelles, entre la fin de J14 et le début de J15.",
  },
];

/** Used when no cohort date is known. */
export const DEFAULT_START = "2027-01-11";
