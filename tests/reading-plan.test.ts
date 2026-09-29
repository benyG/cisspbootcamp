import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DEFAULT_START, DOMAINS, MODULES, buildSessions, planDates } from "@/lib/reading-plan/data";
import { cisspEndsAt, isPlanDate, planStart, readingPlanUrl, renderReadingPlan, scriptJson } from "@/lib/reading-plan/page";
import { planAttachments } from "@/lib/documents";
import { readingPlanLine } from "@/lib/onboarding";

const SESSIONS = buildSessions("2027-01-11"); // a Monday
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

describe("plan de lecture CISSP", () => {
  it("depuis un lundi : 15 jours et 40 heures, mercredis au repos", () => {
    expect(SESSIONS.map((s) => s.n)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(MODULES.reduce((sum, m) => sum + m.h, 0)).toBe(40);
    expect(SESSIONS.reduce((sum, s) => sum + s.hours, 0)).toBe(40);
    for (const s of SESSIONS) expect(s.blocks.reduce((sum, b) => sum + b.h, 0)).toBeCloseTo(s.hours);
    expect(SESSIONS.filter((s) => s.rest).map((s) => s.n)).toEqual([3, 10]);
    for (const s of SESSIONS.filter((s) => s.rest)) expect(s).toMatchObject({ hours: 0, blocks: [], read: [], title: "Journée repos lecture" });
    for (const n of [6, 7, 13, 14]) expect(SESSIONS[n - 1].hours).toBe(5.5);
    for (const s of SESSIONS.filter((s) => !s.rest && ![6, 7, 13, 14].includes(s.n))) expect(s.hours).toBe(2);
    expect(SESSIONS[5].title).toBe("Protection des données et atelier D1-D2, puis principes de conception sûre et cryptographie symétrique");
  });

  // Ben, 29/09: a cohort starting on a Saturday had 5 h 30 on a Thursday.
  for (const start of ["2026-10-03", "2026-10-01", "2026-10-06", "2026-10-09", "2026-10-04", "2026-10-07"]) {
    it(`depuis le ${start} : jamais plus de 2 h en semaine, le mercredi au repos, la fin décalée`, () => {
      const plan = buildSessions(start);
      expect(plan[0].date).toBe(start);
      plan.forEach((s, i) => expect(s.n).toBe(i + 1));
      expect(plan.reduce((sum, s) => sum + s.hours, 0)).toBe(40);
      for (const s of plan) {
        const day = weekday(s.date);
        if (day === 3) expect(s).toMatchObject({ rest: true, hours: 0 });
        else if (day === 0 || day === 6) expect(s.hours).toBeLessThanOrEqual(5.5);
        else expect(s.hours).toBeLessThanOrEqual(2);
        expect(s.blocks.reduce((sum, b) => sum + b.h, 0)).toBeCloseTo(s.hours);
      }
      // Every day before the last is full: the course only runs longer, never looser.
      for (const s of plan.slice(0, -1)) if (!s.rest) expect(s.hours).toBe([5.5, 2, 2, 0, 2, 2, 5.5][weekday(s.date)]);
      // The last day is a real course session, and the mock exam comes a week later.
      const last = plan[plan.length - 1];
      expect(last.rest).toBeUndefined();
      expect(last.hours).toBeGreaterThan(0);
      expect(last.todo).toMatch(/examen blanc vous est envoyé une semaine après/);
      expect(planDates(start)).toEqual({ end: last.date, mockExam: new Date(Date.parse(`${last.date}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10) });
      // Every reading is due exactly once, before or on the day its matter is taught.
      const keys = plan.flatMap((s) => s.read.map((r) => r.key));
      expect(keys.sort()).toEqual(MODULES.flatMap((m) => m.read.map((r) => r.key)).sort());
    });
  }

  it("la cohorte du 3 octobre (un samedi) n'a plus 5 h 30 un jeudi", () => {
    const plan = buildSessions("2026-10-03");
    expect(plan.find((s) => s.date === "2026-10-15")).toMatchObject({ n: 13, hours: 2 });
    expect(plan.slice(0, 2).map((s) => s.hours)).toEqual([5.5, 5.5]);
    expect(planDates("2027-01-11")).toEqual({ end: "2027-01-25", mockExam: "2027-02-01" });
  });

  it("garde le temps de chaque domaine", () => {
    const hours: Record<number, number> = {};
    for (const s of SESSIONS) for (const b of s.blocks) hours[b.d] = (hours[b.d] ?? 0) + b.h;
    expect(hours).toEqual({ 0: 2, 1: 6, 2: 4, 3: 7, 4: 5, 5: 4, 6: 4.5, 7: 4.5, 8: 3 });
  });

  it("couvre les 8 domaines officiels, dont les poids font 100 %", () => {
    expect(Object.values(DOMAINS).reduce((sum, d) => sum + d.weight, 0)).toBe(100);
    const covered = new Set(SESSIONS.flatMap((s) => s.blocks.map((b) => b.d)).filter((d) => d > 0));
    expect([...covered].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("fait lire les 21 chapitres du guide officiel, avec des clés de coche stables", () => {
    const chapters = new Set(SESSIONS.flatMap((s) => s.read.map((r) => r.ch)));
    expect(chapters.size).toBe(21);
    // From a Monday, the keys are those of the first version: ticks already made stay valid.
    for (const s of SESSIONS) s.read.forEach((r, i) => expect(r.key).toBe(`${s.n}-${i}`));
  });

  it("injecte les données et la date de début dans la page", () => {
    const html = renderReadingPlan("<script>const DATA = __DATA__;</script>", "2027-02-08");
    expect(html).not.toContain("__DATA__");
    expect(html).toContain('"defaultStart":"2027-02-08"');
    expect(renderReadingPlan("__DATA__", "n'importe quoi")).toContain(`"defaultStart":"${DEFAULT_START}"`);
  });

  it("n'ouvre jamais une balise dans le script", () => {
    expect(scriptJson({ t: "</script><b>" })).not.toContain("<");
  });

  it("valide les dates et construit le lien de la cohorte", () => {
    expect(isPlanDate("2027-01-11")).toBe(true);
    expect(isPlanDate("2027-13-45")).toBe(false);
    expect(isPlanDate("11/01/2027")).toBe(false);
    expect(planStart(new Date("2027-01-11T18:00:00.000Z"))).toBe("2027-01-11");
    expect(readingPlanUrl("https://x.test", new Date("2027-01-11T00:00:00.000Z"))).toBe("https://x.test/plan-de-lecture?debut=2027-01-11");
    expect(readingPlanLine("https://x.test/p")).toMatch(/^• Plan de lecture interactif.*https:\/\/x\.test\/p$/);
  });

  it("le gabarit garde ses points d'ancrage", () => {
    const template = readFileSync("lib/reading-plan/template.html", "utf8");
    expect(template.match(/__DATA__/g)).toHaveLength(1);
    expect(template).toContain("const SAVED = null;");
    expect(template).toContain("url(/fonts/inter-latin.woff2)");
  });
});

describe("envoi sans fichier", () => {
  it("un e-mail CISSP peut partir avec le seul plan de lecture", () => {
    expect(planAttachments([], [])).toMatchObject({ ok: false });
    expect(planAttachments([], [], undefined, { allowEmpty: true })).toMatchObject({ ok: true, documents: [], attached: [], linked: [] });
  });
});

describe("fin de cohorte CISSP", () => {
  it("se cale sur le calendrier du plan, à la même heure que le début", () => {
    expect(cisspEndsAt(new Date("2027-01-11T17:00:00.000Z")).toISOString()).toBe("2027-01-25T17:00:00.000Z");
    expect(cisspEndsAt(new Date("2026-10-03T17:00:00.000Z")).toISOString()).toBe("2026-10-17T17:00:00.000Z");
  });
});
