import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { videoQuery } from "@/lib/drive";
import { ACCESS_MONTHS, WATERMARK_MOVE_SECONDS, WATERMARK_SPOTS, accessEndsAt, addMonths, formatBytes, isAccessOpen, nextRange, reopenedUntil, watermarkText } from "@/lib/replays";
import { allowedOrigins, createUpload, playbackToken, sendChunk, videoState } from "@/lib/stream";

describe("replays : règles (Ben, 12/10)", () => {
  it("accès jusqu'à 4 mois après la fin de la cohorte, ou après la dernière session personnelle", () => {
    expect(ACCESS_MONTHS).toBe(4);
    expect(accessEndsAt({ cohortEndsAt: new Date("2026-10-18T00:00:00Z") }).toISOString()).toBe("2027-02-18T23:59:59.000Z");
    expect(accessEndsAt({ cohortEndsAt: new Date("2026-10-18T00:00:00Z"), personalLastDate: "2026-11-02" }).toISOString()).toBe("2027-03-02T23:59:59.000Z");
    expect(accessEndsAt({ cohortEndsAt: new Date("2026-10-18T00:00:00Z"), personalLastDate: "2026-10-10" }).toISOString()).toBe("2027-02-18T23:59:59.000Z");
    expect(addMonths(new Date("2026-10-31T00:00:00Z"), 4).toISOString().slice(0, 10)).toBe("2027-02-28");
  });

  it("ouvert jusqu'à la dernière seconde ; une réouverture ne raccourcit jamais", () => {
    const end = new Date("2027-02-18T23:59:59Z");
    expect(isAccessOpen(end, new Date("2027-02-18T23:00:00Z"))).toBe(true);
    expect(isAccessOpen(end, new Date("2027-02-19T00:00:01Z"))).toBe(false);
    expect(reopenedUntil(end, 2, new Date("2027-03-10T00:00:00Z")).toISOString().slice(0, 10)).toBe("2027-05-10");
    expect(reopenedUntil(new Date("2027-06-01T00:00:00Z"), 1, new Date("2027-03-10T00:00:00Z")).toISOString().slice(0, 10)).toBe("2027-07-01");
  });

  it("filigrane discret : le nom et l'e-mail, dans les marges, déplacé lentement", () => {
    expect(watermarkText({ firstName: "Awa", lastName: "Diop", email: "awa@x.test" })).toBe("Awa Diop · awa@x.test");
    expect(WATERMARK_MOVE_SECONDS).toBeGreaterThanOrEqual(60);
    for (const s of WATERMARK_SPOTS) expect(s.top < 20 || s.top > 70).toBe(true);
  });

  it("copie Drive par morceaux, le dernier plus court", () => {
    expect(nextRange(0, 120, 50)).toEqual({ from: 0, to: 49 });
    expect(nextRange(100, 120, 50)).toEqual({ from: 100, to: 119 });
    expect(nextRange(120, 120, 50)).toBeNull();
    expect(formatBytes(3.2 * 1024 ** 3)).toBe("3,2 Go");
  });

  it("recherche Drive : seulement des vidéos, nom échappé", () => {
    expect(videoQuery("")).toBe("mimeType contains 'video/' and trashed = false");
    expect(videoQuery("J3 l'atelier")).toBe("mimeType contains 'video/' and trashed = false and name contains 'J3 l\\'atelier'");
  });
});

describe("Cloudflare Stream", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    process.env.CLOUDFLARE_ACCOUNT_ID = "acc";
    process.env.CLOUDFLARE_STREAM_TOKEN = "tok";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lecture limitée au site, avec et sans www", () => {
    expect(allowedOrigins("https://www.cisspbootcamp.online")).toEqual(["cisspbootcamp.online", "www.cisspbootcamp.online"]);
  });

  it("ouvre un envoi reprenable, privé (lecture signée) et limité au site", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201, headers: { Location: "https://upload.example/tus/abc", "stream-media-id": "uid1" } }));
    expect(await createUpload({ name: "J3.mp4", size: 1000, appUrl: "https://www.cisspbootcamp.online" })).toEqual({ uploadUrl: "https://upload.example/tus/abc", uid: "uid1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.cloudflare.com/client/v4/accounts/acc/stream?direct_user=true");
    expect(init.headers["Upload-Length"]).toBe("1000");
    const meta = init.headers["Upload-Metadata"] as string;
    expect(meta).toContain("requiresignedurls");
    expect(meta).toContain(`allowedorigins ${Buffer.from("cisspbootcamp.online,www.cisspbootcamp.online").toString("base64")}`);
  });

  it("un jeton de lecture court, jamais téléchargeable", async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, result: { token: "signed" } })));
    expect(await playbackToken("uid1", Date.UTC(2026, 9, 12))).toBe("signed");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ exp: Date.UTC(2026, 9, 12) / 1000 + 3 * 3600, downloadable: false });
  });

  it("envoie un morceau et lit le nouvel avancement", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204, headers: { "Upload-Offset": "52428800" } }));
    expect(await sendChunk("https://upload.example/tus/abc", 0, new Uint8Array(10))).toBe(52428800);
    expect(fetchMock.mock.calls[0][1].headers["Upload-Offset"]).toBe("0");
  });

  it("traduit l'état de la vidéo", () => {
    expect(videoState({ readyToStream: true, status: { state: "ready" }, duration: 19800.4 })).toEqual({ ready: true, state: "ready", error: null, duration: 19800 });
    expect(videoState({ status: { state: "inprogress" } }).ready).toBe(false);
    expect(videoState({ status: { state: "error", errorReasonText: "codec" } }).error).toBe("codec");
  });
});
