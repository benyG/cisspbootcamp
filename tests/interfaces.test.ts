import { describe, expect, it } from "vitest";

import { formatQuoteNumber } from "@/lib/admin-records";
import { JOURNAL_CATEGORIES, journalLabel, typesOf } from "@/lib/journal";
import { ALL_TOOLS } from "@/lib/mcp/catalog";
import { morningDigest, morningDue } from "@/lib/morning";
import { parseWatch, watchParagraph } from "@/lib/watch";

const base = {
  now: new Date("2026-11-16T06:15:00Z"),
  todo: {},
  yesterday: { leads: 0, calls: 0, payments: 0, paidUsdCents: 0 },
  questions: 0,
  deadlinesSoon: 0,
  privacySoon: 0,
  ai: { spentUsd: 3.5, budgetUsd: 30 },
  stopped: false,
  appUrl: "https://www.cisspbootcamp.online/",
};

describe("morning e-mail", () => {
  it("stays silent on a quiet day", () => {
    expect(morningDigest(base)).toBeNull();
  });
  it("lists today's to-do and yesterday's numbers", () => {
    const d = morningDigest({ ...base, todo: { call: 2, payment: 1 }, questions: 1, yesterday: { leads: 3, calls: 1, payments: 1, paidUsdCents: 60_000 } })!;
    expect(d.subject).toBe("Ce matin : 3 points à traiter");
    expect(d.text).toContain("• 2 appels aujourd’hui");
    expect(d.text).toContain("• 1 paiement à confirmer");
    expect(d.text).toContain("• 1 question de visiteur");
    expect(d.text).toContain("Hier : 3 nouveaux leads, 1 appel réservé, 1 paiement (600 USD).");
    expect(d.text).toContain("3.50 USD sur 30 USD (12 %)");
  });
  it("says so when everything is stopped", () => {
    expect(morningDigest({ ...base, stopped: true })!.subject).toBe("Ce matin : arrêt général en cours");
  });
  it("is due once a day from 6 a.m. UTC", () => {
    expect(morningDue(new Date("2026-11-16T05:59:00Z"), null)).toBe(false);
    expect(morningDue(new Date("2026-11-16T06:00:00Z"), null)).toBe(true);
    expect(morningDue(new Date("2026-11-16T09:00:00Z"), "2026-11-16")).toBe(false);
    expect(morningDue(new Date("2026-11-17T06:00:00Z"), "2026-11-16")).toBe(true);
  });
});

describe("market watch", () => {
  const searched = new Set(["https://www.isc2.org/news/exam-update/", "https://example.org/bootcamp"]);
  it("keeps only items whose link came out of the search", () => {
    const items = parseWatch(
      [
        "- ISC² change l’examen || https://www.isc2.org/news/exam-update || Revoir le plan de révision.",
        "Concurrent inventé || https://invente.example/promo || Ne doit pas passer.",
        "RIEN",
        "Bootcamp concurrent || https://example.org/bootcamp). || Prix affiché à comparer.",
      ].join("\n"),
      searched,
    );
    expect(items.map((i) => i.url)).toEqual(["https://www.isc2.org/news/exam-update", "https://example.org/bootcamp"]);
    expect(items[0]!.title).toBe("ISC² change l’examen");
  });
  it("adds a paragraph to the Monday report only when there is something", () => {
    expect(watchParagraph([])).toEqual([]);
    expect(watchParagraph([{ title: "T", url: "https://u", why: "W" }])[1]).toBe("- T : W (https://u)");
  });
});

describe("journal", () => {
  it("names actions in French and groups them", () => {
    expect(journalLabel("payment_confirmed")).toBe("Paiement confirmé");
    expect(journalLabel("something_new")).toBe("something new");
    expect(typesOf("ai")).toEqual(expect.arrayContaining(["ai_usage", "market_watch"]));
    expect(typesOf("sales")).toContain("payment_confirmed");
    expect(typesOf("playbooks")!.every((t) => JOURNAL_CATEGORIES.playbooks.match(t))).toBe(true);
    expect(typesOf(null)).toBeNull();
  });
});

describe("quotes and MCP", () => {
  it("numbers quotes continuously", () => {
    expect(formatQuoteNumber(12)).toBe("DEV-000012");
  });
  it("a read-only client keeps only read tools, and there are some", () => {
    const read = ALL_TOOLS.filter((t) => t.level === "read");
    expect(read.length).toBeGreaterThan(5);
    expect(read.length).toBeLessThan(ALL_TOOLS.length);
  });
});
