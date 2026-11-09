import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(async () => [{ 1: 1 }]),
  exchangeRate: { findFirst: vi.fn(async () => null as unknown) },
  linkedinCredential: { findUnique: vi.fn(async () => null as unknown) },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_APP_URL: "https://x.test", ADMIN_EMAIL: "ben@x.test", GOOGLE_TOKEN_ENCRYPTION_KEY: "" } }));
vi.mock("@/lib/calendar/google", () => ({ getCredential: vi.fn(async () => null), fetchBusy: vi.fn() }));
vi.mock("@vercel/blob", () => ({ list: vi.fn(async () => ({ blobs: [] })) }));

import { CHECKS, runCheck, summary } from "@/lib/health/checks";

const check = (id: string) => runCheck(CHECKS.find((c) => c.id === id)!);
const respond = (status: number, body: unknown = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
const KEYS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "RESEND_API_KEY", "EMAIL_FROM", "ANTHROPIC_API_KEY", "CRON_SECRET", "NETTICKET_API_KEY", "NETTICKET_FALLBACK_URL"];

describe("santé des intégrations", () => {
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; } vi.clearAllMocks(); });
  afterEach(() => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } vi.unstubAllGlobals(); });

  it("never shows a secret, and says where to set a missing key", async () => {
    const r = await check("stripe");
    expect(r.status).toBe("fail");
    expect(r.fix!.join(" ")).toContain("STRIPE_SECRET_KEY");
    expect(r.fix!.join(" ")).toContain("Environment Variables");
  });

  it("tells a refused key from a missing webhook and from test mode", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    vi.stubGlobal("fetch", respond(401));
    expect((await check("stripe")).detail).toBe("Stripe refuse la clé secrète.");
    vi.stubGlobal("fetch", respond(200));
    expect((await check("stripe")).detail).toContain("STRIPE_WEBHOOK_SECRET manquant");
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    const test = await check("stripe");
    expect(test.status).toBe("warn");
    expect(test.detail).toContain("TEST");
    expect(JSON.stringify(test)).not.toContain("sk_test_abc");
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    expect((await check("stripe")).status).toBe("ok");
  });

  it("accepts a sending-only Resend key and flags an unverified domain", async () => {
    process.env.RESEND_API_KEY = "re_x";
    process.env.EMAIL_FROM = "Ben <ben@cisspbootcamp.online>";
    vi.stubGlobal("fetch", respond(401, { name: "restricted_api_key", message: "This API key is restricted to only send emails" }));
    expect((await check("email")).status).toBe("ok");
    vi.stubGlobal("fetch", respond(200, { data: [{ name: "cisspbootcamp.online", status: "pending" }] }));
    const pending = await check("email");
    expect(pending.status).toBe("fail");
    expect(pending.fix!.join(" ")).toContain("Hostinger");
    vi.stubGlobal("fetch", respond(200, { data: [{ name: "cisspbootcamp.online", status: "verified" }] }));
    expect((await check("email")).status).toBe("ok");
  });

  it("checks the AI key and model without spending anything", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    const fetchMock = respond(404);
    vi.stubGlobal("fetch", fetchMock);
    expect((await check("anthropic")).status).toBe("warn");
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain("/v1/models/");
  });

  it("sees a stopped cron from the morning exchange rates", async () => {
    process.env.CRON_SECRET = "s";
    db.exchangeRate.findFirst.mockResolvedValueOnce({ updatedAt: new Date(Date.now() - 50 * 3_600_000) });
    expect((await check("cron")).status).toBe("fail");
    db.exchangeRate.findFirst.mockResolvedValueOnce({ updatedAt: new Date(Date.now() - 3 * 3_600_000) });
    expect((await check("cron")).status).toBe("ok");
  });

  it("turns an exception or a timeout into a failure with what to do", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-x";
    vi.stubGlobal("fetch", vi.fn(async () => { throw new DOMException("The operation was aborted due to timeout", "TimeoutError"); }));
    const r = await check("anthropic");
    expect(r.status).toBe("fail");
    expect(r.detail).toBe("Pas de réponse en 8 s.");
    expect(r.fix).toBeDefined();
  });

  it("marks what is not plugged in yet, and counts by status", async () => {
    expect((await check("meta")).status).toBe("off");
    expect((await check("netticket")).status).toBe("off");
    expect(summary([{ status: "ok" }, { status: "fail" }, { status: "fail" }, { status: "off" }] as never)).toEqual({ ok: 1, fail: 2, warn: 0, off: 1 });
  });
});
