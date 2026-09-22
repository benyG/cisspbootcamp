/**
 * ExamBoot "one-click test" API — docs/CONVERSION.md §8. Two calls, both
 * server-to-server with the platform key: create a shareable test, read its
 * results. The key never reaches the browser (CLAUDE.md, secrets).
 */

export const EXAMBOOT_QUESTIONS = 5;
export const EXAMBOOT_TIMER_MINUTES = 10;

export type CreatedTest = { id: number; code: string; url: string };

export type TestResults = {
  code: string;
  certification: string;
  questions: number;
  status: "pending" | "completed";
  latest: { nickname: string; percent: number; correct: number; questions: number; finished_at: string } | null;
};

export class ExamBootError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ExamBootError";
  }
}

function config() {
  const apiKey = process.env.EXAMBOOT_API_KEY ?? "";
  const baseUrl = (process.env.EXAMBOOT_BASE_URL ?? "https://examboot.net").replace(/\/$/, "");
  const certification = Number(process.env.EXAMBOOT_CISSP_ID ?? "4");
  return { apiKey, baseUrl, certification };
}

/** The feature is on only with a key: without it, every button stays hidden. */
export function examBootEnabled(): boolean {
  return config().apiKey.length > 0;
}

export async function createTest(fetchImpl: typeof fetch = fetch): Promise<CreatedTest> {
  const { apiKey, baseUrl, certification } = config();
  if (!apiKey) throw new ExamBootError("EXAMBOOT_API_KEY manquante", 0);
  const response = await fetchImpl(`${baseUrl}/create-test`, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ type: "shareable", quest: EXAMBOOT_QUESTIONS, certi: certification, timer: EXAMBOOT_TIMER_MINUTES }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new ExamBootError(`ExamBoot create-test → ${response.status}`, response.status);
  const data = (await response.json()) as Partial<CreatedTest>;
  if (!data.code || !data.url) throw new ExamBootError("Réponse ExamBoot sans code ni URL", 502);
  return { id: Number(data.id ?? 0), code: data.code, url: data.url };
}

export async function fetchResults(code: string, fetchImpl: typeof fetch = fetch): Promise<TestResults> {
  const { apiKey, baseUrl } = config();
  if (!apiKey) throw new ExamBootError("EXAMBOOT_API_KEY manquante", 0);
  const response = await fetchImpl(`${baseUrl}/create-test/${encodeURIComponent(code)}/results`, {
    headers: { "X-API-KEY": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new ExamBootError(`ExamBoot results → ${response.status}`, response.status);
  return parseResults(await response.json());
}

/** Pure: shapes the results payload, tolerant to missing fields. */
export function parseResults(raw: unknown): TestResults {
  const data = (raw ?? {}) as Record<string, unknown>;
  const latestRaw = data.latest as Record<string, unknown> | null | undefined;
  const latest = latestRaw
    ? {
        nickname: String(latestRaw.nickname ?? "").slice(0, 80),
        percent: clampInt(latestRaw.percent, 0, 100),
        correct: clampInt(latestRaw.correct, 0, 1000),
        questions: clampInt(latestRaw.questions ?? data.questions, 1, 1000),
        finished_at: String(latestRaw.finished_at ?? ""),
      }
    : null;
  return {
    code: String(data.code ?? ""),
    certification: String(data.certification ?? ""),
    questions: clampInt(data.questions, 1, 1000),
    status: data.status === "completed" && latest ? "completed" : "pending",
    latest,
  };
}

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}
