import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  marketingVideo: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const blob = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn() }));
vi.mock("@vercel/blob", () => blob);

import { GIVE_UP_MINUTES, mapStatus, startVideo, syncVideo } from "@/lib/minimax";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const ok = { base_resp: { status_code: 0, status_msg: "success" } };

describe("MiniMax (Ben, 03/10)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    process.env.MINIMAX_API_KEY = "test-key";
    for (const f of [...Object.values(db.marketingVideo), blob.put, fetchMock]) f.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MINIMAX_API_KEY;
  });

  it("traduit les états de MiniMax", () => {
    expect(mapStatus("Success")).toBe("done");
    expect(mapStatus("Fail")).toBe("failed");
    expect(mapStatus("Processing")).toBe("processing");
    expect(mapStatus("Queueing")).toBe("queued");
    expect(mapStatus(undefined)).toBe("queued");
  });

  it("crée un plan de 6 s avec le modèle et la résolution réglables", async () => {
    fetchMock.mockResolvedValueOnce(json({ task_id: "t1", ...ok }));
    db.marketingVideo.create.mockResolvedValueOnce({ id: 9 });
    expect(await startVideo(3, "Slow push in on a security manager")).toEqual({ ok: true, id: 9 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.minimax.io/v1/video_generation");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body)).toEqual({ model: "MiniMax-Hailuo-02", prompt: "Slow push in on a security manager", duration: 6, resolution: "768P" });
    expect(db.marketingVideo.create).toHaveBeenCalledWith({ data: expect.objectContaining({ postId: 3, taskId: "t1" }) });
  });

  it("une clé refusée donne un message clair, sans rien enregistrer", async () => {
    fetchMock.mockResolvedValueOnce(json({ base_resp: { status_code: 1004, status_msg: "authorized failed" } }));
    expect(await startVideo(3, "prompt long enough here")).toMatchObject({ ok: false, error: expect.stringMatching(/MINIMAX_API_KEY/) });
    expect(db.marketingVideo.create).not.toHaveBeenCalled();
    delete process.env.MINIMAX_API_KEY;
    expect(await startVideo(3, "prompt long enough here")).toMatchObject({ ok: false });
  });

  it("une fois prête, copie la vidéo dans le stockage privé", async () => {
    db.marketingVideo.findUnique.mockResolvedValueOnce({ id: 9, postId: 3, taskId: "t1", status: "processing", createdAt: new Date() });
    fetchMock
      .mockResolvedValueOnce(json({ status: "Success", file_id: "f1", ...ok }))
      .mockResolvedValueOnce(json({ file: { download_url: "https://cdn.example/v.mp4" }, ...ok }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    blob.put.mockResolvedValueOnce({ pathname: "marketing-videos/post-3-video-9-x.mp4" });
    await syncVideo(9);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.minimax.io/v1/query/video_generation?task_id=t1");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.minimax.io/v1/files/retrieve?file_id=f1");
    expect(blob.put).toHaveBeenCalledWith(expect.stringMatching(/^marketing-videos\/post-3-video-9/), expect.any(Buffer), expect.objectContaining({ access: "private", contentType: "video/mp4" }));
    expect(db.marketingVideo.update).toHaveBeenCalledWith({ where: { id: 9 }, data: { status: "done", blobPathname: "marketing-videos/post-3-video-9-x.mp4", error: null } });
  });

  it("abandonne après une heure sans résultat", async () => {
    db.marketingVideo.findUnique.mockResolvedValueOnce({ id: 9, postId: 3, taskId: "t1", status: "queued", createdAt: new Date(Date.now() - (GIVE_UP_MINUTES + 1) * 60_000) });
    await syncVideo(9);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.marketingVideo.update).toHaveBeenCalledWith({ where: { id: 9 }, data: expect.objectContaining({ status: "failed" }) });
  });
});
