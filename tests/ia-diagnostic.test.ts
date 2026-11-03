import { describe, expect, it } from "vitest";

import { type IaAnswers, PRIORITY_COUNT, READY_EASE, diagnose, diagnosisSummary } from "@/lib/ia-diagnostic";
import { iaAnswersSchema } from "@/lib/ia-diagnostic-schema";

const base: IaAnswers = { activity: "tpe", tasks: ["reseaux", "relance", "devis", "chiffres"], hours: "10", tools: "excel", ease: "3" };

describe("diagnostic d’automatisation (Ben, 03/11)", () => {
  it("ranks the ticked tasks by impact, whatever the order they were ticked in", () => {
    const d = diagnose(base);
    expect(d.priorities.map((p) => p.code)).toEqual(["relance", "devis", "chiffres"]);
    expect(d.priorities).toHaveLength(PRIORITY_COUNT);
    expect(d.priorities[0]).toMatchObject({ title: "Relancer vos prospects sans y penser" });
    expect(d.priorities[0].how).toMatch(/^J3/);
  });

  it("keeps fewer priorities when fewer tasks are ticked", () => {
    expect(diagnose({ ...base, tasks: ["questions"] }).priorities.map((p) => p.code)).toEqual(["questions"]);
  });

  it("starts directly from the ease threshold, with an onboarding session below", () => {
    expect(READY_EASE).toBe(3);
    expect(diagnose({ ...base, ease: "3" }).ready).toBe(true);
    expect(diagnose({ ...base, ease: "4" }).ready).toBe(true);
    expect(diagnose({ ...base, ease: "2" }).ready).toBe(false);
    expect(diagnose({ ...base, ease: "1" }).ready).toBe(false);
  });

  it("says where the application starts from and how much time is at stake", () => {
    const d = diagnose(base);
    expect(d.hoursPhrase).toBe("5 à 10 h");
    expect(d.toolsNote).toMatch(/Excel/);
    expect(diagnose({ ...base, tools: "logiciel" }).toolsNote).toMatch(/si celui-ci le permet/);
  });

  it("promises no gain and no figure", () => {
    for (const tools of ["excel", "whatsapp", "logiciel", "rien"] as const) {
      const text = JSON.stringify(diagnose({ ...base, tools, tasks: ["relance", "paiements", "devis", "rdv", "chiffres", "questions", "reseaux"] }));
      expect(text).not.toMatch(/garanti|économis|\d+ ?%/i);
    }
  });

  it("validates the answers", () => {
    expect(iaAnswersSchema.safeParse(base).success).toBe(true);
    expect(iaAnswersSchema.safeParse({ ...base, tasks: [] }).success).toBe(false);
    expect(iaAnswersSchema.safeParse({ ...base, tasks: ["relance", "relance"] }).success).toBe(false);
    expect(iaAnswersSchema.safeParse({ ...base, tasks: ["autre"] }).success).toBe(false);
    expect(iaAnswersSchema.safeParse({ ...base, ease: "5" }).success).toBe(false);
    expect(iaAnswersSchema.safeParse({ ...base, activity: undefined }).success).toBe(false);
  });

  it("sums the answers up in one line for Ben", () => {
    expect(diagnosisSummary({ ...base, ease: "2" })).toBe("TPE · 5 à 10 h par semaine · publier sur les réseaux, relancer les prospects, faire les devis et les factures, préparer les chiffres du mois · outils : Excel ou Google Sheets · aisance 2/4 (séance d’accueil)");
  });
});
