import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DEFAULT_START, DOMAINS, SESSIONS } from "@/lib/reading-plan/data";
import { isPlanDate, planStart, readingPlanUrl, renderReadingPlan, scriptJson } from "@/lib/reading-plan/page";
import { planAttachments } from "@/lib/documents";
import { readingPlanLine } from "@/lib/onboarding";

describe("plan de lecture CISSP", () => {
  it("tient en 15 jours et 40 heures, mercredis au repos", () => {
    expect(SESSIONS.map((s) => s.n)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(SESSIONS.reduce((sum, s) => sum + s.hours, 0)).toBe(40);
    for (const s of SESSIONS) expect(s.blocks.reduce((sum, b) => sum + b.h, 0)).toBeCloseTo(s.hours);
    // J1 is a Monday: J3 and J10 are Wednesdays, J6-J7 and J13-J14 weekends.
    expect(SESSIONS.filter((s) => s.rest).map((s) => s.n)).toEqual([3, 10]);
    for (const s of SESSIONS.filter((s) => s.rest)) expect(s).toMatchObject({ hours: 0, blocks: [], read: [], title: "Journée repos lecture" });
    for (const n of [6, 7, 13, 14]) expect(SESSIONS[n - 1].hours).toBe(5.5);
    for (const s of SESSIONS.filter((s) => !s.rest && ![6, 7, 13, 14].includes(s.n))) expect(s.hours).toBe(2);
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

  it("fait lire les 21 chapitres du guide officiel", () => {
    const chapters = new Set(SESSIONS.flatMap((s) => s.read.map((r) => r.ch)));
    expect(chapters.size).toBe(21);
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
