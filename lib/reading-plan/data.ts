/**
 * The CISSP reading plan (Ben, 25/09 and 29/09): 40 hours of live sessions,
 * the eight official domains, and what to read in the Sybex Official Study
 * Guide before each session. The page itself is lib/reading-plan/template.html;
 * this is its data. Reading times are estimates and drive the page's agenda.
 *
 * The course is a sequence of modules; the calendar is set by the weekday
 * (Ben, 29/09): Monday, Tuesday, Thursday and Friday evenings never exceed
 * 2 h, Wednesday is a rest day, and only Saturday and Sunday take 5 h 30. A
 * cohort that does not start on a Monday simply ends later.
 */

export type ReadingKind = "full" | "only" | "except" | "range" | "review";
/** key: stable id of the reading, used for the participant's ticks (kept from the first version of the plan). */
export type Reading = { key: string; ch: number; kind: ReadingKind; text: string; min: number };
/** d: the domain (0 for the closing synthesis), h: hours spent on it in the session. */
export type Session = { n: number; date: string; hours: number; blocks: Array<{ d: number; h: number }>; title: string; goal: string; read: Reading[]; todo?: string; rest?: boolean };
/** One teaching unit, in course order. A module may run over two days. */
export type Module = { d: number; h: number; title: string; goal: string; read: Reading[]; todo?: string };

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

function read(key: string, ch: number, kind: ReadingKind, text = "", min = READING_MINUTES[kind]): Reading {
  return { key, ch, kind, text, min };
}

/** Hours of live session by weekday, Sunday first (Ben, 25/09 and 29/09). */
export const SESSION_HOURS_BY_WEEKDAY = [5.5, 2, 2, 0, 2, 2, 5.5] as const;
/** The mock exam is sent this many days after the last session, for revision (Ben, 29/09). */
export const MOCK_EXAM_DELAY_DAYS = 7;

/** The course, in order: 40 hours. From a Monday, it fills exactly 15 days. */
export const MODULES: Module[] = [
  {
    d: 1, h: 2,
    title: "Gouvernance, éthique et sécurité du personnel",
    goal: "Poser le cadre du manager : gouvernance, rôles, politiques, code d’éthique ISC².",
    read: [read("1-0", 19, "only", "Ethics"), read("1-1", 1, "except", "Threat Modeling, vu ensuite"), read("1-2", 2, "only", "Personnel Security Policies")],
  },
  {
    d: 1, h: 2,
    title: "Gestion des risques et modélisation des menaces",
    goal: "Raisonner en risque : analyse, traitement, contrôles, modélisation des menaces.",
    read: [read("2-0", 2, "except", "Personnel Security Policies (déjà lu) et Social Engineering (vu plus tard)"), read("2-1", 1, "only", "Threat Modeling")],
  },
  {
    d: 1, h: 2,
    title: "Lois, conformité et continuité d’activité",
    goal: "Cadres légaux, propriété intellectuelle, vie privée, puis le plan de continuité (PCA).",
    read: [read("4-0", 4, "full"), read("4-1", 3, "full")],
  },
  {
    d: 2, h: 2,
    title: "Classification et cycle de vie des actifs",
    goal: "Classer, détenir, conserver et éliminer l’information ; provisionner les ressources.",
    read: [read("5-0", 5, "except", "Data Protection Methods, lu pour la session suivante"), read("5-1", 16, "only", "Provision Resources Securely")],
  },
  {
    d: 2, h: 2,
    title: "Protection des données et atelier D1-D2",
    goal: "Méthodes de protection des données et 45 minutes de questions corrigées sur les domaines 1 et 2.",
    read: [read("6-0", 5, "only", "Data Protection Methods")],
  },
  {
    d: 3, h: 3.5,
    title: "Principes de conception sûre et cryptographie symétrique",
    goal: "Principes de conception sûre, modèles de sécurité, vulnérabilités des architectures, cryptographie symétrique.",
    read: [read("6-1", 8, "full"), read("6-2", 9, "full"), read("6-3", 6, "full")],
  },
  {
    d: 3, h: 3.5,
    title: "PKI, sécurité physique et cloud",
    goal: "Cryptographie asymétrique, PKI, sécurité physique et services cloud.",
    read: [read("7-0", 7, "full"), read("7-1", 10, "full"), read("7-2", 16, "only", "Separation of Duties · Manage Services in the Cloud")],
  },
  {
    d: 4, h: 2,
    title: "Architecture réseau",
    goal: "Modèles OSI et TCP/IP.",
    read: [read("7-3", 11, "range", "Du début jusqu’à « Wireless Networks »")],
  },
  {
    d: 4, h: 2,
    title: "Sans-fil et technologies réseau",
    goal: "Réseaux sans fil, composants réseau, commutation, WAN, NAT, supports de transmission.",
    read: [read("8-0", 11, "range", "De « Wireless Networks » jusqu’à la fin"), read("8-1", 12, "only", "Switching Technologies · WAN Technologies · NAT · Cabling and Transmission Media · Fiber-Optic Links")],
  },
  {
    d: 4, h: 1,
    title: "Communications sécurisées",
    goal: "VLAN, VPN, messagerie, accès distant, voix, SDN.",
    read: [read("9-0", 12, "only", "Secure Network Components · Switching and Virtual LANs · Virtual Private Network · Manage Email Security · Remote Access Security Management · Secure Voice Communications · Software-Defined Networking", 60)],
  },
  {
    d: 5, h: 1,
    title: "Fondamentaux de l’identité",
    goal: "Les fondamentaux de l’identité et du contrôle d’accès.",
    read: [read("9-1", 13, "range", "Du début jusqu’à « Implementing Identity Management »")],
  },
  {
    d: 5, h: 2,
    title: "Gestion des identités et authentification",
    goal: "Cycle de vie des identités, fédération, modèles de contrôle d’accès.",
    read: [read("11-0", 13, "range", "Le reste, à partir de « Implementing Identity Management »"), read("11-1", 14, "range", "Du début jusqu’à « Implementing Authentication Systems »")],
  },
  {
    d: 5, h: 1,
    title: "Systèmes d’authentification",
    goal: "Kerberos, SSO, attaques sur l’accès.",
    read: [read("12-0", 14, "range", "Le reste, à partir de « Implementing Authentication Systems »")],
  },
  {
    d: 6, h: 1,
    title: "Stratégies d’évaluation et d’audit",
    goal: "Stratégies d’évaluation, de test et d’audit.",
    read: [read("12-1", 15, "range", "Du début jusqu’à « Testing Your Software »")],
  },
  {
    d: 6, h: 3.5,
    title: "Tests, sensibilisation et atelier audit",
    goal: "Tests de code et d’application, indicateurs, ingénierie sociale et sensibilisation, scénarios d’audit corrigés.",
    read: [read("13-0", 15, "range", "Le reste, à partir de « Testing Your Software »"), read("13-1", 2, "only", "Social Engineering · Security Awareness")],
  },
  {
    d: 7, h: 2,
    title: "Opérations de sécurité et gestion des incidents",
    goal: "Opérations de sécurité, gestion des incidents, prévention.",
    read: [read("13-2", 16, "except", "Provision Resources Securely · Separation of Duties · Manage Services in the Cloud, déjà lus"), read("13-3", 17, "full")],
  },
  {
    d: 7, h: 2.5,
    title: "Reprise après sinistre, enquêtes et preuves",
    goal: "Plan de reprise après sinistre (PRA), enquêtes et preuves.",
    read: [read("14-0", 18, "full"), read("14-1", 19, "except", "Ethics, déjà lu")],
  },
  {
    d: 8, h: 3,
    title: "Développement logiciel sûr",
    goal: "Cycle de développement, bases de données, attaques applicatives.",
    read: [read("14-2", 20, "full"), read("14-3", 21, "full")],
  },
  {
    d: 0, h: 2,
    title: "Synthèse des 8 domaines et méthode d’examen",
    goal: "Dernière session de cours : les notions clés des 8 domaines reliées entre elles, le raisonnement du manager, la stratégie du format adaptatif et votre plan de révision.",
    read: [],
    todo: "L’examen blanc vous est envoyé une semaine après cette dernière session : cette semaine sert à réviser.",
  },
];

/** A Wednesday without a live session (Ben, 25/09): rest, and time to read ahead. */
function restDay(n: number, date: string): Session {
  return { n, date, hours: 0, blocks: [], rest: true, title: "Journée repos lecture", goal: "Pas de session en ligne aujourd’hui. Reposez-vous, puis avancez vos lectures : c’est le jour pour prendre de l’avance sur les prochaines sessions.", read: [] };
}

const lowerFirst = (t: string) => (/^.[a-zà-ÿ’' ]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t);

function isoDay(start: string, offset: number): string {
  return new Date(Date.parse(`${start}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The calendar from a start date (YYYY-MM-DD): one entry per day until the
 * course is done, J1 being the start. Each day takes the hours its weekday
 * allows; a module that does not fit runs over to the next session day, and
 * each reading is due on the day its part of the module is taught.
 */
export function buildSessions(start: string): Session[] {
  const cursor = newCursor();
  const out: Session[] = [];
  for (let offset = 0; !cursor.done(); offset++) {
    const date = isoDay(start, offset);
    const room = SESSION_HOURS_BY_WEEKDAY[new Date(`${date}T12:00:00Z`).getUTCDay()];
    out.push(room === 0 ? restDay(offset + 1, date) : sessionOf(offset + 1, date, cursor.take(room)));
  }
  return out;
}

/**
 * A personal calendar (Ben, 04/10): the course packed in order into the days
 * a participant chose, each with its own room in hours. Numbered J1, J2… in
 * date order; days left once the course is done are not used.
 */
export function packSessions(days: ReadonlyArray<{ date: string; room: number }>): Session[] {
  const cursor = newCursor();
  const out: Session[] = [];
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    if (cursor.done()) break;
    out.push(sessionOf(out.length + 1, day.date, cursor.take(day.room)));
  }
  return out;
}

/** Total hours of the course (40). */
export const COURSE_HOURS = MODULES.reduce((sum, m) => sum + m.h, 0);

type Part = { mod: Module; h: number; from: number; to: number };

/** Walks the modules in order; take(room) hands out up to `room` hours, a module running over to the next day. */
function newCursor() {
  const left = MODULES.map((m) => m.h);
  let m = 0;
  return {
    done: () => m >= MODULES.length,
    take(room: number): Part[] {
      const parts: Part[] = [];
      while (room > 0 && m < MODULES.length) {
        const mod = MODULES[m];
        const h = Math.min(room, left[m]);
        const from = mod.h - left[m];
        parts.push({ mod, h, from, to: from + h });
        left[m] -= h;
        room -= h;
        if (left[m] === 0) m++;
      }
      return parts;
    },
  };
}

function sessionOf(n: number, date: string, parts: Part[]): Session {
  const read = parts.flatMap(({ mod, from, to }) => {
    const total = mod.read.reduce((sum, r) => sum + r.min, 0);
    let before = 0;
    return mod.read.filter((r) => {
      const at = total ? (before / total) * mod.h : 0; // where this reading's matter starts in the module
      before += r.min;
      return at >= from && (at < to || (to === mod.h && at <= to));
    });
  });
  const titles = parts.map((p, i) => (p.from > 0 ? `${i ? "suite : " : "Suite : "}${lowerFirst(p.mod.title)}` : i ? lowerFirst(p.mod.title) : p.mod.title));
  const goals = parts.map((p, i) => (i ? lowerFirst(p.mod.goal) : p.mod.goal).replace(/\.$/, ""));
  const todo = parts.map((p) => (p.to === p.mod.h ? p.mod.todo : undefined)).find(Boolean);
  const blocks: Session["blocks"] = [];
  for (const p of parts) {
    const last = blocks[blocks.length - 1];
    if (last && last.d === p.mod.d) last.h += p.h;
    else blocks.push({ d: p.mod.d, h: p.h });
  }
  return {
    n,
    date,
    hours: parts.reduce((sum, p) => sum + p.h, 0),
    blocks,
    title: titles.join(", puis "),
    goal: `${goals.join(" ; puis ")}.`,
    read,
    ...(todo ? { todo } : {}),
  };
}

export { isoDay };

/** Day of the last session, and of the mock exam a week later (YYYY-MM-DD). */
export function planDates(start: string): { end: string; mockExam: string } {
  const sessions = buildSessions(start);
  const end = sessions[sessions.length - 1].date;
  return { end, mockExam: isoDay(end, MOCK_EXAM_DELAY_DAYS) };
}

/** Used when no cohort date is known. */
export const DEFAULT_START = "2027-01-11";
