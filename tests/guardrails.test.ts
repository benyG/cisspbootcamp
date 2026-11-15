import { describe, expect, it } from "vitest";

import { AI_FEATURES, budgetMonth, costUsd, crossedLevels, monthStart, priceOf } from "@/lib/ai-usage";
import { AUTOMATION_KEYS, DEFAULT_GUARDRAILS, automationRuns, automationState, pressureReached, resolveGuardrails } from "@/lib/guardrails";

describe("resolveGuardrails", () => {
  it("gives the defaults for nothing stored", () => {
    expect(resolveGuardrails(null)).toEqual(DEFAULT_GUARDRAILS);
    expect(resolveGuardrails("junk")).toEqual(DEFAULT_GUARDRAILS);
    expect(DEFAULT_GUARDRAILS.aiBudgetUsd).toBe(30);
  });

  it("keeps valid values and repairs invalid ones field by field", () => {
    const g = resolveGuardrails({ stopped: true, stoppedAt: "2026-11-15T10:00:00Z", off: ["content", "nope"], aiBudgetUsd: 50, pressurePerWeek: 9 });
    expect(g.stopped).toBe(true);
    expect(g.off).toEqual(["content"]);
    expect(g.aiBudgetUsd).toBe(50);
    expect(g.pressurePerWeek).toBe(2);
    expect(resolveGuardrails({ aiBudgetUsd: -1 }).aiBudgetUsd).toBe(30);
  });
});

describe("automation switches", () => {
  it("runs everything by default", () => {
    for (const k of AUTOMATION_KEYS) expect(automationRuns(DEFAULT_GUARDRAILS, k)).toBe(true);
  });

  it("stops one automation with its switch", () => {
    const g = { ...DEFAULT_GUARDRAILS, off: ["content" as const] };
    expect(automationRuns(g, "content")).toBe(false);
    expect(automationState(g, "content")).toBe("off");
    expect(automationRuns(g, "playbooks")).toBe(true);
  });

  it("the general stop suspends all but the Monday report", () => {
    const g = { ...DEFAULT_GUARDRAILS, stopped: true };
    expect(automationState(g, "bookingReminders")).toBe("stopped");
    expect(automationRuns(g, "mondayReport")).toBe(true);
    expect(automationState({ ...g, off: ["mondayReport" as const] }, "mondayReport")).toBe("off");
  });
});

describe("pressureReached", () => {
  const now = new Date("2026-11-15T12:00:00Z");
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
  it("counts the last seven days only", () => {
    expect(pressureReached([daysAgo(1)], now, 2)).toBe(false);
    expect(pressureReached([daysAgo(1), daysAgo(6)], now, 2)).toBe(true);
    expect(pressureReached([daysAgo(1), daysAgo(8)], now, 2)).toBe(false);
    expect(pressureReached([daysAgo(1)], now, 1)).toBe(true);
  });
});

describe("AI cost", () => {
  it("prices a response from its usage", () => {
    expect(costUsd("claude-opus-5-5", { input_tokens: 1_000_000, output_tokens: 100_000 })).toBeCloseTo(6);
    expect(costUsd("claude-opus-5-5", { input_tokens: 0, cache_read_input_tokens: 1_000_000 })).toBeCloseTo(0.2);
    expect(costUsd("claude-opus-5-5", { output_tokens: 0, server_tool_use: { web_search_requests: 3 } })).toBeCloseTo(0.03);
  });

  it("prices dated or unknown models safely", () => {
    expect(priceOf("claude-opus-5-5-20261101").input).toBe(4);
    expect(priceOf("claude-unknown").output).toBe(25);
  });

  it("finds the budget month and the alert levels crossed", () => {
    const now = new Date("2026-11-15T12:00:00Z");
    expect(budgetMonth(now)).toBe("2026-11");
    expect(monthStart(now).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(crossedLevels(20, 25, 30)).toEqual([80]);
    expect(crossedLevels(25, 31, 30)).toEqual([100]);
    expect(crossedLevels(10, 31, 30)).toEqual([80, 100]);
    expect(crossedLevels(25, 26, 30)).toEqual([]);
    expect(crossedLevels(0, 5, 0)).toEqual([]);
  });

  it("names every AI feature in French", () => {
    for (const label of Object.values(AI_FEATURES)) expect(label.length).toBeGreaterThan(3);
  });
});
