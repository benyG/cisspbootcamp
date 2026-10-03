"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { type NewsItem, type TopicIdea, type Variant, draftFollowup, generateVariants, searchNews, suggestTopics } from "@/lib/marketing/ai";
import { examBootEnabled } from "@/lib/examboot/client";
import { audienceInsights, cohortFacts, factsForModel, recentPosts, recentTestStats } from "@/lib/marketing/data";
import { CHANNELS, DESTINATIONS, FORMATS, PILLARS, POST_CODE_PATTERN, type SegmentKey, newPostCode, pillarOf, trackedLink, withLink } from "@/lib/marketing/plan";
import { loadMarketingSettings, saveMarketingSettings } from "@/lib/marketing/settings";
import { MAX_IMAGE_BYTES, publishOnLinkedin } from "@/lib/linkedin";
import { sendEmail } from "@/lib/messaging/email";
import { recommendedService, serviceDefinition } from "@/lib/services";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const channel = z.enum(Object.keys(CHANNELS) as [keyof typeof CHANNELS, ...Array<keyof typeof CHANNELS>]);
const pillar = z.enum(Object.keys(PILLARS) as [keyof typeof PILLARS, ...Array<keyof typeof PILLARS>]);
const format = z.enum(Object.keys(FORMATS) as [keyof typeof FORMATS, ...Array<keyof typeof FORMATS>]);
const destination = z.enum(Object.keys(DESTINATIONS) as [keyof typeof DESTINATIONS, ...Array<keyof typeof DESTINATIONS>]);
const id = z.coerce.number().int().positive();

export type StudioVariant = Variant & { code: string; link: string; destination: keyof typeof DESTINATIONS };

/**
 * Ten subject ideas (Ben, 29/09): from what prospects say and do, what was
 * already published this month, and, when asked, the news found on the web.
 */
export async function suggestTopicIdeas(input: { cohortId: number; withNews: boolean }): Promise<{ ok: true; ideas: TopicIdea[]; news: NewsItem[]; newsError: string | null } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = z.object({ cohortId: id, withNews: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  const settings = await loadMarketingSettings();
  const [facts, tests, insights, recent, news] = await Promise.all([
    cohortFacts(parsed.data.cohortId),
    recentTestStats(settings.testThreshold),
    audienceInsights(),
    recentPosts(),
    parsed.data.withNews ? searchNews() : Promise.resolve(null),
  ]);
  if (!facts) return { ok: false, error: "Cohorte introuvable." };
  const newsItems = news?.ok ? news.items : [];
  const result = await suggestTopics({
    facts: factsForModel(facts, tests.stats),
    insights,
    recent: recent.map((p) => `- ${PILLARS[pillarOf(p)].label} · ${p.format ?? "standard"} · ${p.topic ?? p.text.split("\n")[0].slice(0, 120)}`).join("\n"),
    news: newsItems.map((n) => `- ${n.title} (${n.date}) — ${n.url} — ${n.why}`).join("\n"),
  });
  if (!result.ok) return result;
  return { ok: true, ideas: result.ideas, news: newsItems, newsError: news && !news.ok ? news.error : null };
}

/** Three variants for a channel, a pillar, a format and a subject, each with its own tracked link. */
export async function generatePosts(input: { cohortId: number; channel: string; pillar: string; format: string; topic: string; destination: string; brief: string }): Promise<{ ok: true; variants: StudioVariant[] } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = z.object({ cohortId: id, channel, pillar, format, topic: z.string().trim().max(600), destination, brief: z.string().trim().max(1200) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choisissez un canal, un pilier, un format et une destination." };
  const d = parsed.data;
  if (!(FORMATS[d.format].channels as readonly string[]).includes(d.channel)) return { ok: false, error: `Le format « ${FORMATS[d.format].label} » ne convient pas à ${CHANNELS[d.channel].label}.` };
  if (d.destination === "test" && !examBootEnabled()) return { ok: false, error: "Le test d'entraînement n'est pas activé sur le site : choisissez une autre destination." };
  if (!d.topic && !d.brief) return { ok: false, error: "Donnez un sujet (ou choisissez une idée), ou écrivez ce que vous voulez dire." };
  const settings = await loadMarketingSettings();
  const [facts, tests] = await Promise.all([cohortFacts(d.cohortId), recentTestStats(settings.testThreshold)]);
  if (!facts) return { ok: false, error: "Cohorte introuvable." };
  const result = await generateVariants({ facts: factsForModel(facts, tests.stats), channel: d.channel, pillar: d.pillar, format: d.format, topic: d.topic, destination: d.destination, brief: d.brief });
  if (!result.ok) return result;
  return {
    ok: true,
    variants: result.variants.map((v) => {
      const code = newPostCode(d.channel);
      const link = trackedLink(env.NEXT_PUBLIC_APP_URL, d.channel, facts.id, code, d.destination);
      return { ...v, code, link, destination: d.destination, text: withLink(v.text, link) };
    }),
  };
}

const saveSchema = z.object({
  cohortId: id,
  channel,
  pillar,
  format,
  topic: z.string().trim().max(240),
  destination,
  code: z.string().regex(POST_CODE_PATTERN),
  text: z.string().trim().min(10).max(6000),
  visual: z.object({ format: z.string(), scene: z.string(), onScreenText: z.string(), direction: z.string() }),
  video: z.object({ scenes: z.array(z.object({ seconds: z.number(), image: z.string(), voiceover: z.string(), onScreen: z.string() })), minimaxPrompt: z.string() }).nullable(),
});

/** Keeps a variant (as Ben edited it) in the cohort's library. */
export async function savePost(input: z.input<typeof saveSchema>): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Contenu invalide." };
  const d = parsed.data;
  await prisma.marketingPost.upsert({
    where: { code: d.code },
    create: { cohortId: d.cohortId, channel: d.channel, angle: d.pillar, pillar: d.pillar, format: d.format, topic: d.topic || null, destination: d.destination, code: d.code, text: d.text, visualBrief: JSON.stringify(d.visual), video: d.video && d.video.scenes.length ? JSON.stringify(d.video) : null },
    update: { text: d.text },
  });
  revalidatePath("/admin/marketing");
  return { ok: true };
}

export async function togglePublished(formData: FormData): Promise<void> {
  await requireAdmin();
  const postId = id.parse(formData.get("postId"));
  const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { publishedAt: true } });
  if (post) await prisma.marketingPost.update({ where: { id: postId }, data: { publishedAt: post.publishedAt ? null : new Date() } });
  revalidatePath("/admin/marketing");
}

export async function deletePost(formData: FormData): Promise<void> {
  await requireAdmin();
  await prisma.marketingPost.delete({ where: { id: id.parse(formData.get("postId")) } }).catch(() => undefined);
  revalidatePath("/admin/marketing");
}

const SEGMENT_REASON: Record<SegmentKey, string> = {
  called: "Elle a fait l'appel découverte avec Ben mais ne s'est pas inscrite.",
  test_high: "Bon score au test d'entraînement, sans place réservée : elle peut viser l'examen plus vite avec la méthode et le rythme du bootcamp.",
  test_low: "Score au test d'entraînement sous le seuil, sans place réservée : le bootcamp travaille justement ces angles morts, avec un coach.",
  hot: "Profil chaud (forte intention), pas encore testé : le test de 5 questions est le prochain pas naturel.",
  associate: "Profil éligible via le titre Associate of ISC² : elle peut passer l'examen dès maintenant.",
  conseil: "Son échéance est plus courte que le délai estimé par l'analyse : un échange de conseil d'abord, pour bâtir un plan réaliste.",
  cc: "Profil qui débute : la bonne première marche est la certification CC d'ISC², ou un bilan de carrière.",
};

const segmentKey = z.enum(["called", "test_high", "test_low", "hot", "associate", "conseil", "cc"]);

/** A personal follow-up for one consenting prospect. Nothing is sent here. */
export async function draftFollowupFor(input: { leadId: number; cohortId: number; channel: "whatsapp" | "email"; segment: string }): Promise<{ ok: true; text: string; subject: string | null } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = z.object({ leadId: id, cohortId: id, channel: z.enum(["whatsapp", "email"]), segment: segmentKey }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  const [lead, facts] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: parsed.data.leadId },
      include: {
        scannerResponses: { orderBy: { createdAt: "desc" }, take: 1, select: { resultToken: true, analysis: true, answers: true } },
        practiceTests: { where: { status: "completed", percent: { not: null } }, orderBy: { finishedAt: "desc" }, take: 1, select: { percent: true, correct: true, questions: true } },
      },
    }),
    cohortFacts(parsed.data.cohortId),
  ]);
  if (!lead || !facts) return { ok: false, error: "Introuvable." };
  if (!lead.consentAt || lead.unsubscribedAt) return { ok: false, error: "Cette personne n'a pas accepté d'être recontactée." };
  const scan = lead.scannerResponses[0];
  const analysis = scan?.analysis as { headline?: string; timeline?: { label?: string } } | undefined;
  const test = lead.practiceTests[0];
  const person = [
    `Prénom : ${lead.firstName}`,
    lead.jobTitle ? `Poste : ${lead.jobTitle}` : null,
    `Pays : ${lead.country}`,
    lead.readiness ? `Verdict de l'analyse : ${lead.readiness}${analysis?.headline ? ` — ${analysis.headline}` : ""}` : null,
    analysis?.timeline?.label ? `Délai estimé, accompagné : ${analysis.timeline.label}` : null,
    test ? `Test d'entraînement : ${test.correct} bonne${(test.correct ?? 0) > 1 ? "s" : ""} réponse${(test.correct ?? 0) > 1 ? "s" : ""} sur ${test.questions} (${test.percent} %).` : "Test d'entraînement : pas encore fait.",
    lead.goals ? `Ses objectifs, écrits par elle : « ${lead.goals} »` : null,
  ].filter(Boolean).join("\n");

  // What to offer and where the link leads, by segment (Ben, 29/09).
  const app = env.NEXT_PUBLIC_APP_URL;
  const resultLink = scan?.resultToken ? `${app}/scanner/resultat/${scan.resultToken}` : trackedLink(app, "whatsapp_status", facts.id, "relance");
  let offer = `Sa place dans la cohorte ${facts.name}.`;
  let link = resultLink;
  let linkWhat = "sa page de résultat, avec son analyse et l'inscription à la cohorte";
  const segment = parsed.data.segment;
  if (segment === "hot" && examBootEnabled() && scan?.resultToken) {
    offer = "Le test gratuit de 5 questions d'entraînement, pour voir comment elle raisonne ; la cohorte ensuite.";
    link = `${app}/test-cissp?from=relance&t=${scan.resultToken}`;
    linkWhat = "son test d'entraînement personnel (5 questions, 10 minutes, sans compte) ; son score s'affichera sur sa fiche";
  } else if (segment === "conseil" || segment === "cc") {
    const answers = (scan?.answers ?? {}) as { experience?: string; professionalStatus?: string };
    const service = serviceDefinition(recommendedService(lead.readiness ?? "not_yet", answers as never));
    const cc = segment === "cc" ? "la certification CC d'ISC² comme première marche (présentée sur sa page de résultat), ou " : "";
    offer = `${cc}une séance de conseil « ${service.name} » : ${service.tagline}`;
    link = segment === "cc" ? resultLink : `${app}/conseil/${service.code}`;
    linkWhat = segment === "cc" ? linkWhat : `la page de la séance « ${service.name} », avec son prix et la prise de rendez-vous`;
  }

  const result = await draftFollowup({ facts: factsForModel(facts), channel: parsed.data.channel, person, segment: SEGMENT_REASON[segment], offer, link: linkWhat });
  if (!result.ok) return result;
  let text = withLink(result.text, link);
  let subject: string | null = null;
  const match = /^Objet\s*:\s*(.+)\n+/i.exec(text);
  if (match) {
    subject = match[1].trim();
    text = text.slice(match[0].length);
  }
  return { ok: true, text, subject: parsed.data.channel === "email" ? subject ?? `${lead.firstName}, votre place pour la ${facts.name}` : null };
}

/** Ben's score threshold for the "test réussi" and "test à consolider" segments. */
export async function saveTestThreshold(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = z.coerce.number().int().min(20).max(100).safeParse(formData.get("testThreshold"));
  if (parsed.success) await saveMarketingSettings({ testThreshold: parsed.data });
  revalidatePath("/admin/marketing");
}

/** Sends one follow-up e-mail Ben has read, with the unsubscribe link. */
export async function sendFollowupEmail(input: { leadId: number; subject: string; text: string }): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  const parsed = z.object({ leadId: id, subject: z.string().trim().min(3).max(160), text: z.string().trim().min(20).max(5000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Objet et message requis." };
  const lead = await prisma.lead.findUnique({ where: { id: parsed.data.leadId } });
  if (!lead || !lead.consentAt || lead.unsubscribedAt) return { ok: false, error: "Cette personne n'a pas accepté d'être recontactée." };
  const result = await sendEmail({
    to: lead.email,
    subject: parsed.data.subject,
    text: `${parsed.data.text}\n\n—\nPour ne plus recevoir de messages : ${env.NEXT_PUBLIC_APP_URL}/desinscription/${lead.unsubscribeToken}`,
  });
  if (!result.sent) return { ok: false, error: `E-mail non envoyé : ${result.reason}` };
  await prisma.actionLog.create({ data: { leadId: lead.id, type: "marketing_followup_sent", channel: "email", payload: { subject: parsed.data.subject } } });
  revalidatePath("/admin/marketing");
  return { ok: true };
}

/** WhatsApp leaves from Ben's phone: he marks it sent once he has. */
export async function markFollowupSent(input: { leadId: number }): Promise<void> {
  await requireAdmin();
  const leadId = id.parse(input.leadId);
  await prisma.actionLog.create({ data: { leadId, type: "marketing_followup_sent", channel: "whatsapp" } });
  revalidatePath("/admin/marketing");
}

/**
 * Publishes a kept post on Ben's LinkedIn profile (Ben, 03/10), with an
 * optional image (the visual made from the brief). The post is marked
 * published and keeps its tracked link.
 */
export async function publishPostOnLinkedin(formData: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  await requireAdmin();
  const postId = id.safeParse(formData.get("postId"));
  if (!postId.success) return { ok: false, error: "Post introuvable." };
  const post = await prisma.marketingPost.findUnique({ where: { id: postId.data } });
  if (!post) return { ok: false, error: "Post introuvable." };
  if (post.linkedinUrn) return { ok: false, error: "Ce post est déjà publié sur LinkedIn." };
  const file = formData.get("image");
  let image: { bytes: Uint8Array; type: string; alt: string } | null = null;
  if (file instanceof File && file.size > 0) {
    if (!["image/jpeg", "image/png"].includes(file.type)) return { ok: false, error: "Image en JPG ou PNG seulement." };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: "Image trop lourde : 4 Mo au plus." };
    const brief = (() => { try { return (JSON.parse(post.visualBrief) as { onScreenText?: string }).onScreenText ?? ""; } catch { return ""; } })();
    image = { bytes: new Uint8Array(await file.arrayBuffer()), type: file.type, alt: brief || "Visuel CISSP Bootcamp" };
  }
  try {
    const published = await publishOnLinkedin({ text: post.text, image });
    await prisma.marketingPost.update({ where: { id: post.id }, data: { linkedinUrn: published.urn || null, publishedAt: new Date() } });
    revalidatePath("/admin/marketing");
    return { ok: true, url: published.url };
  } catch (error) {
    console.error("[linkedin] publication", error);
    return { ok: false, error: error instanceof Error ? error.message : "Publication refusée par LinkedIn." };
  }
}
