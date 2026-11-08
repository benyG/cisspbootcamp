import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  analystReport: { findUnique: vi.fn(async () => null as unknown), upsert: vi.fn<(args: unknown) => Promise<unknown>>(async () => ({})) },
  siteSetting: { findUnique: vi.fn(async () => null as unknown) },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const snap = vi.hoisted(() => ({ buildSnapshot: vi.fn(async () => ({ cohortes: [{ cohorte: "CISSP Bootcamp — Janvier", placesPayees: 4, objectif: 10 }], certificationsTunnel: { resultatsVus: { semaine: 23 }, appelsReserves: { semaine: 1, avant: 4 }, tauxAppelSurResultatVu: 4 }, sources: ["linkedin : 230 visites, 5 analyses, 0 payés"] })) }));
vi.mock("@/lib/analyst/snapshot", () => snap);
const ai = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error { status = 500; }
  class Anthropic { static APIError = APIError; beta = { messages: { create: ai.create } }; }
  return { default: Anthropic };
});

import { type AnalystOutput, analystWeekKey, delta, groundOutput, isAnalystDay, numbersIn, rate, readDecisions, reportParagraph } from "@/lib/analyst/rules";
import { generateAnalysis, runAnalyst } from "@/lib/analyst/server";

const bet = (over: Partial<AnalystOutput["bets"][number]> = {}) => ({ title: "Rappeler les analyses prêtes sans appel", confidence: "solid" as const, facts: [{ label: "Résultats vus", value: "23" }, { label: "Appels réservés", value: "1 (4 la semaine d’avant)" }], action: "Un message à chacun depuis la file.", watch: { metric: "appels réservés", target: "4 ou plus" }, ...over });
const reply = (output: unknown, stop = "end_turn") => ({ stop_reason: stop, content: [{ type: "text", text: JSON.stringify(output) }] });

describe("analyst rules", () => {
  it("keys the analysis on the coming Monday, and runs on Sundays", () => {
    expect(analystWeekKey(new Date("2026-11-08T05:30:00Z"))).toBe("2026-11-09"); // Sunday
    expect(analystWeekKey(new Date("2026-11-09T05:30:00Z"))).toBe("2026-11-09"); // Monday
    expect(analystWeekKey(new Date("2026-11-11T12:00:00Z"))).toBe("2026-11-16"); // Wednesday
    expect(isAnalystDay(new Date("2026-11-08T05:30:00Z"))).toBe(true);
    expect(isAnalystDay(new Date("2026-11-09T05:30:00Z"))).toBe(false);
  });

  it("reads numbers as written in French", () => {
    expect(numbersIn("1 180 visites, 13 %, 85,5 USD")).toEqual([1180, 13, 85.5]);
    expect(numbersIn("1 240")).toEqual([1240]);
    expect(numbersIn("aucune")).toEqual([]);
  });

  it("removes figures not found in the snapshot, and an orientation left without any", () => {
    const snapshot = { a: 23, b: "1 (4 la semaine d’avant)", c: ["230 visites"] };
    const { output, removed } = groundOutput({ diagnosis: "x", review: [], bets: [bet(), bet({ title: "Inventé", facts: [{ label: "Taux du marché", value: "37 %" }] }), bet({ title: "Mixte", facts: [{ label: "Visites", value: "230" }, { label: "Inventé", value: "999" }] })] }, snapshot);
    expect(output.bets.map((b) => b.title)).toEqual(["Rappeler les analyses prêtes sans appel", "Mixte"]);
    expect(output.bets[1]!.facts).toEqual([{ label: "Visites", value: "230" }]);
    expect(removed).toBe(3);
  });

  it("computes changes and rates only when there is something to compare", () => {
    expect(delta(12, 10)).toBe(20);
    expect(delta(5, 0)).toBeNull();
    expect(rate(1, 23)).toBe(4);
    expect(rate(1, 0)).toBeNull();
  });

  it("reads decisions defensively and writes the Monday paragraph", () => {
    expect(readDecisions({ "1": { status: "kept", at: "x" } })).toEqual({ "1": { status: "kept", at: "x" } });
    expect(readDecisions("garbage")).toEqual({});
    const lines = reportParagraph({ diagnosis: "En retard d’une place.", bets: [bet()], review: [] }, "https://x.test/admin/analyste");
    expect(lines.join("\n")).toContain("1. Rappeler les analyses prêtes sans appel (chiffres solides)");
    expect(lines.join("\n")).toContain("Retenir ou écarter : https://x.test/admin/analyste");
    expect(reportParagraph({ diagnosis: "", bets: [], review: [] }, "u")).toEqual([]);
  });
});

describe("analyst run", () => {
  beforeEach(() => { vi.clearAllMocks(); db.analystReport.findUnique.mockResolvedValue(null); });

  it("stores grounded orientations for the coming Monday, decisions reset", async () => {
    ai.create.mockResolvedValueOnce(reply({ diagnosis: "Les visites tiennent ; les appels baissent.", bets: [bet(), bet({ title: "Inventé", facts: [{ label: "x", value: "77" }] })], review: [] }));
    const out = await generateAnalysis(new Date("2026-11-08T05:30:00Z"));
    expect(out).toEqual({ ok: true, weekKey: "2026-11-09", bets: 1, removed: 2 });
    const call = ai.create.mock.calls[0]![0] as { messages: Array<{ content: string }>; output_config: { format: { type: string } } };
    expect(call.output_config.format.type).toBe("json_schema");
    expect(call.messages[0]!.content).toContain("PHOTO de la semaine");
    const saved = db.analystReport.upsert.mock.calls[0]![0] as unknown as { where: { weekKey: string }; create: { output: AnalystOutput; decisions: object } };
    expect(saved.where.weekKey).toBe("2026-11-09");
    expect(saved.create.output.bets.map((b) => b.title)).toEqual(["Rappeler les analyses prêtes sans appel"]);
    expect(saved.create.decisions).toEqual({});
  });

  it("stores nothing on a refusal, a cut answer or an unreadable one", async () => {
    ai.create.mockResolvedValueOnce(reply({}, "refusal"));
    expect((await generateAnalysis()).ok).toBe(false);
    ai.create.mockResolvedValueOnce(reply({ nope: 1 }));
    expect((await generateAnalysis()).ok).toBe(false);
    expect(db.analystReport.upsert).not.toHaveBeenCalled();
  });

  it("runs from the cron on Sundays only, once a week, when on", async () => {
    const sunday = new Date("2026-11-08T05:30:00Z");
    expect(await runAnalyst(new Date("2026-11-09T05:30:00Z"), "on")).toBe("not_today");
    expect(await runAnalyst(sunday, "trial")).toBe("trial");
    expect(await runAnalyst(sunday, "off")).toBe("off");
    db.analystReport.findUnique.mockResolvedValueOnce({ id: 1 });
    expect(await runAnalyst(sunday, "on")).toBe("already");
    ai.create.mockResolvedValueOnce(reply({ diagnosis: "ok", bets: [bet()], review: [] }));
    expect(await runAnalyst(sunday, "on")).toBe("done");
    expect(ai.create).toHaveBeenCalledTimes(1);
  });
});
