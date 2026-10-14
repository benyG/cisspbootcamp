import { ExamBootError, config, failure, headers } from "./client";

/**
 * ExamBoot API v1 (Ben, 14/10): the CISSP domains, and tests built on chosen
 * domains with one personal link per recipient. The e-mail leaves from this
 * site (send_email: false), so ExamBoot only hands back the links.
 */

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { apiKey, baseUrl } = config();
  if (!apiKey) throw new ExamBootError("EXAMBOOT_API_KEY manquante", 0);
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method: init.method ?? "GET",
    headers: headers(apiKey, init.body !== undefined),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 422) {
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new ExamBootError(`ExamBoot refuse la demande : ${data?.message ?? "données invalides"}`, 422);
    }
    throw await failure(`ExamBoot ${init.method ?? "GET"} ${path}`, response);
  }
  return ((await response.json()) as { data: T }).data;
}

export async function cisspDomains(): Promise<Array<{ id: number; name: string; questions: number }>> {
  return call(`/certifications/${config().certification}/domains`);
}

export type NewTest = {
  type: "test" | "exam";
  title: string;
  domains: Array<{ id: number; questions: number }>;
  timer?: number;
  dueAt: Date;
  message?: string;
  recipients: Array<{ email: string; name: string }>;
};

export type TestRecipient = { id: number; email: string; link: string };

export async function createDomainTest(input: NewTest): Promise<{ code: string; recipients: TestRecipient[] }> {
  const data = await call<{ code: string; recipients?: Array<{ id: number; email: string; link: string }> }>("/tests", {
    method: "POST",
    body: {
      certification_id: config().certification,
      type: input.type,
      title: input.title,
      domains: input.domains,
      ...(input.timer ? { timer: input.timer } : {}),
      due_at: input.dueAt.toISOString(),
      locale: "fr",
      ...(input.message ? { message: input.message } : {}),
      recipients: input.recipients,
      send_email: false,
    },
  });
  if (!data?.code) throw new ExamBootError("Réponse ExamBoot sans code de test", 502);
  return { code: data.code, recipients: (data.recipients ?? []).filter((r) => r.id && r.email && r.link).map((r) => ({ id: r.id, email: r.email.toLowerCase(), link: r.link })) };
}

export async function readTest(code: string): Promise<{ recipients: unknown[] }> {
  const data = await call<{ recipients?: unknown[] }>(`/tests/${encodeURIComponent(code)}`);
  return { recipients: data?.recipients ?? [] };
}
