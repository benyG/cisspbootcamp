import { afterEach, describe, expect, it, vi } from "vitest";

import { ExamBootError, createTest, examBootEnabled, fetchResults, parseResults } from "@/lib/examboot/client";
import { bucket, isPlacement } from "@/lib/examboot/service";

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

afterEach(() => {
  delete process.env.EXAMBOOT_API_KEY;
  delete process.env.EXAMBOOT_CISSP_ID;
});

describe("createTest", () => {
  it("envoie la clé, le type shareable et la certification CISSP (4) depuis le serveur", async () => {
    process.env.EXAMBOOT_API_KEY = "k";
    const fetchMock = vi.fn(async () => jsonResponse(200, { id: 1, code: "Share_x", url: "https://examboot.net/shared/Share_x" }));
    const test = await createTest(fetchMock as unknown as typeof fetch);
    expect(test.code).toBe("Share_x");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://examboot.net/create-test");
    expect((init.headers as Record<string, string>)["X-API-KEY"]).toBe("k");
    expect(JSON.parse(String(init.body))).toEqual({ type: "shareable", quest: 5, certi: 4, timer: 10 });
  });

  it("refuse sans clé et remonte le statut HTTP en erreur", async () => {
    expect(examBootEnabled()).toBe(false);
    await expect(createTest(vi.fn() as unknown as typeof fetch)).rejects.toBeInstanceOf(ExamBootError);
    process.env.EXAMBOOT_API_KEY = "k";
    const fetchMock = vi.fn(async () => new Response("Too Many Attempts.", { status: 429 }));
    await expect(createTest(fetchMock as unknown as typeof fetch)).rejects.toMatchObject({ status: 429 });
  });
});

describe("résultats", () => {
  it("lit le score du dernier participant", async () => {
    process.env.EXAMBOOT_API_KEY = "k";
    const fetchMock = vi.fn(async () => jsonResponse(200, { code: "Share_x", certification: "CISSP", questions: 5, status: "completed", latest: { nickname: "fan", percent: 80, correct: 4, questions: 5, finished_at: "2026-09-22T14:03:11+00:00" }, participants: [] }));
    const results = await fetchResults("Share_x", fetchMock as unknown as typeof fetch);
    expect(results.status).toBe("completed");
    expect(results.latest?.percent).toBe(80);
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toBe("https://examboot.net/create-test/Share_x/results");
  });

  it("reste « pending » tant que personne n'a révélé de score, même si le statut ment", () => {
    expect(parseResults({ code: "c", status: "completed", latest: null, questions: 5 }).status).toBe("pending");
    expect(parseResults({ code: "c", status: "pending", latest: { nickname: "x", percent: 140, correct: 9, questions: 5 } }).latest?.percent).toBe(100);
  });
});

describe("placements et tranches", () => {
  it("n'accepte que les emplacements connus", () => {
    expect(isPlacement("resultat")).toBe(true);
    expect(isPlacement("hero")).toBe(false);
  });
  it("classe les scores en tranches lisibles", () => {
    expect([bucket(95), bucket(60), bucket(45), bucket(10)]).toEqual(["80+", "60-79", "40-59", "<40"]);
  });
});
