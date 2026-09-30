import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error { status = 500; }
  class Anthropic { beta = { messages: { create } }; static APIError = APIError; }
  return { default: Anthropic };
});

import { draftFollowup, generateVariants, parseNews, searchNews, suggestTopics } from "@/lib/marketing/ai";

const variant = {
  title: "Accroche places",
  text: "Plus que 4 places. Analysez votre profil : [LIEN]",
  hashtags: ["#CISSP"],
  visual: { format: "1080 × 1350", scene: "Une ingénieure devant un tableau blanc", onScreenText: "4 places", direction: "Nuit et vert" },
  video: { scenes: [], minimaxPrompt: "" },
};

describe("studio : appel au modèle", () => {
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = "test"; create.mockReset(); });
  afterEach(() => { delete process.env.ANTHROPIC_API_KEY; });

  it("demande un JSON structuré, avec repli automatique, et le lit", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ variants: [variant, variant, variant] }) }] });
    const result = await generateVariants({ facts: "Cohorte : test", channel: "linkedin", angle: "places", brief: "" });
    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.variants).toHaveLength(3);
    const request = create.mock.calls[0][0];
    expect(request.model).toBe("claude-opus-5-5");
    expect(request.fallbacks).toBe("default");
    expect(request.betas).toContain("server-side-fallback-2026-07-01");
    expect(request.output_config.format.type).toBe("json_schema");
    expect(request.messages[0].content).toContain("Cohorte : test");
    expect(request.system[0].text).toContain("N'invente aucun chiffre");
  });

  it("un refus ou une réponse coupée donne un message clair", async () => {
    create.mockResolvedValue({ stop_reason: "refusal", content: [] });
    expect(await generateVariants({ facts: "x", channel: "tiktok", angle: "cc", brief: "" })).toMatchObject({ ok: false });
    create.mockResolvedValue({ stop_reason: "max_tokens", content: [] });
    expect(await generateVariants({ facts: "x", channel: "tiktok", angle: "cc", brief: "" })).toMatchObject({ ok: false, error: expect.stringMatching(/coupée/) });
  });

  it("sans clé, ne tente rien", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(await generateVariants({ facts: "x", channel: "linkedin", angle: "places", brief: "" })).toMatchObject({ ok: false });
    expect(create).not.toHaveBeenCalled();
  });

  it("annonce la destination du lien : le test ou l'analyse", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ variants: [variant] }) }] });
    await generateVariants({ facts: "Cohorte : test", channel: "tiktok", angle: "test", destination: "test", brief: "" });
    expect(create.mock.calls[0][0].messages[0].content).toMatch(/Le lien \[LIEN\] mène à : un test gratuit de 5 questions d'entraînement/);
    await generateVariants({ facts: "Cohorte : test", channel: "linkedin", angle: "places", brief: "" });
    expect(create.mock.calls[1][0].messages[0].content).toMatch(/Le lien \[LIEN\] mène à : l'analyse de profil gratuite/);
    expect(create.mock.calls[1][0].system[0].text).toContain("il ne prédit jamais le résultat");
  });

  it("une relance reçoit l'offre et la destination de son segment", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: "Bonjour Awa, votre score de 2 sur 5 montre… [LIEN] Ben" }] });
    const result = await draftFollowup({ facts: "Cohorte : test", channel: "whatsapp", person: "Prénom : Awa\nTest d'entraînement : 2 bonnes réponses sur 5 (40 %).", segment: "Score sous le seuil", offer: "Sa place dans la cohorte.", link: "sa page de résultat" });
    expect(result).toMatchObject({ ok: true });
    const content = create.mock.calls[0][0].messages[0].content;
    expect(content).toContain("2 bonnes réponses sur 5");
    expect(content).toContain("Ce qu'on lui propose : Sa place dans la cohorte.");
    expect(content).toContain("Le lien [LIEN] mène à : sa page de résultat");
  });

  it("un post de valeur : pilier, format et sujet dans la demande", async () => {
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ variants: [variant] }) }] });
    await generateVariants({ facts: "Cohorte : test", channel: "linkedin", pillar: "carriere", format: "cas", topic: "Devenir RSSI", destination: "conseil", brief: "Un appel hier avec un ingénieur réseau" });
    const content = create.mock.calls[0][0].messages[0].content;
    expect(content).toContain("Pilier éditorial : Carrière cyber. C'est un post de valeur");
    expect(content).toContain("Sujet : Devenir RSSI");
    expect(content).toContain("Format : Mini-cas « Que feriez-vous ? »");
    expect(content).toMatch(/mène à : les séances de conseil carrière/);
    expect(content).toContain("Un appel hier avec un ingénieur réseau");
    expect(create.mock.calls[0][0].system[0].text).toContain("sans aucun chiffre de marché");
  });

  it("idées : JSON structuré, et une idée au format impossible pour son canal est écartée", async () => {
    const idea = { pillar: "methode", format: "cas", channel: "linkedin", destination: "test", title: "Le réflexe du manager", hook: "Un incident à 2 h du matin…", why: "Beaucoup d'objectifs parlent de méthode.", source: "" };
    create.mockResolvedValue({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ ideas: [idea, { ...idea, format: "carrousel", channel: "tiktok" }] }) }] });
    const result = await suggestTopics({ facts: "Cohorte : test", insights: "- réussir malgré le travail", recent: "", news: "" });
    expect(result).toMatchObject({ ok: true, ideas: [idea] });
    const request = create.mock.calls[0][0];
    expect(request.output_config.format.type).toBe("json_schema");
    expect(request.messages[0].content).toContain("réussir malgré le travail");
    expect(request.messages[0].content).toContain("Aucune : n'en invente pas.");
    expect(request.system[0].text).toContain("Ne cite jamais leurs phrases");
  });

  it("actualité : recherche web, reprise d'un tour en pause, sources obligatoires", async () => {
    create
      .mockResolvedValueOnce({ stop_reason: "pause_turn", content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "cyber Sénégal" } }] })
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [{ type: "text", text: "Loi X adoptée || 2026-09-20 || https://example.org/loi || Parler conformité\nSans source || 2026-09-21 || pas une url || rien" }] });
    const result = await searchNews();
    expect(result).toEqual({ ok: true, items: [{ title: "Loi X adoptée", date: "2026-09-20", url: "https://example.org/loi", why: "Parler conformité" }] });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].tools[0]).toMatchObject({ type: "web_search_20260209", name: "web_search" });
    expect(create.mock.calls[0][0].output_config.format).toBeUndefined();
    expect(create.mock.calls[1][0].messages.at(-1).role).toBe("assistant");
  });

  it("lit les lignes d'actualité", () => {
    expect(parseNews("1. Titre || 2026-09-01 || http://a.b/c || utile")).toEqual([{ title: "Titre", date: "2026-09-01", url: "http://a.b/c", why: "utile" }]);
    expect(parseNews("du texte libre")).toEqual([]);
  });
});
