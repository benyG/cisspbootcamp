import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  marketingVideo: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
const blob = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn() }));
vi.mock("@vercel/blob", () => blob);

import { GIVE_UP_MINUTES, generatePhoto, mapStatus, startVideo, syncVideo } from "@/lib/minimax";

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
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "MiniMax-Hailuo-02", duration: 6, resolution: "768P" });
    // Ben's prompt first, then the brand's film rules.
    expect(body.prompt).toMatch(/^Slow push in on a security manager\n\n/);
    expect(body.prompt).toMatch(/night-blue/);
    expect(body.prompt).toMatch(/no text/);
    expect(body.first_frame_image).toBeUndefined();
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
  it("une image de départ ouvre le plan sur la photo du visuel", async () => {
    fetchMock.mockResolvedValueOnce(json({ task_id: "t2", ...ok }));
    db.marketingVideo.create.mockResolvedValueOnce({ id: 10 });
    await startVideo(3, "Slow push in on a security manager", { bytes: new Uint8Array([0xff, 0xd8, 1]), type: "image/jpeg" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).first_frame_image).toBe("data:image/jpeg;base64,/9gB");
  });

  it("génère une photo dans la charte, sans texte, au bon format", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { image_base64: [Buffer.from([0xff, 0xd8, 0xff]).toString("base64")] }, ...ok }));
    const result = await generatePhoto("A security manager reviews a risk register with her team", "3:4");
    expect(result).toMatchObject({ ok: true, type: "image/jpeg", model: "image-01" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.minimax.io/v1/image_generation");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: "image-01", aspect_ratio: "3:4", response_format: "base64", n: 1, prompt_optimizer: false });
    expect(body.prompt).toMatch(/^A security manager reviews a risk register/);
    expect(body.prompt).toMatch(/Strictly no text/);
  });

  it("une image refusée par MiniMax donne un message clair", async () => {
    fetchMock.mockResolvedValueOnce(json({ data: { image_base64: [] }, metadata: { failed_count: "1" }, ...ok }));
    expect(await generatePhoto("A scene long enough", "1:1")).toMatchObject({ ok: false, error: expect.stringMatching(/reformulez/) });
  });
});
