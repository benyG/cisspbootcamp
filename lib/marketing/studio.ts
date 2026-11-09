import { z } from "zod";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { examBootEnabled } from "@/lib/examboot/client";
import { ACTIVITIES, HOURS, type IaDiagnosis, TASKS, TOOLS } from "@/lib/ia-diagnostic";
import { iaUrl } from "@/lib/ia-domain";
import { type NewsItem, type TopicIdea, type Variant, draftFollowup, generateVariants, searchNews, suggestTopics } from "@/lib/marketing/ai";
import { audienceInsights, cohortFacts, factsForModel, recentPosts, recentTestStats } from "@/lib/marketing/data";
import { ALL_DESTINATIONS, ALL_PILLARS, CHANNELS, FORMATS, IA_SEGMENTS, type MarketingKind, POST_CODE_PATTERN, type SegmentKey, destinationsFor, marketingKind, newPostCode, pillarOf, pillarsFor, trackedLink, withLink } from "@/lib/marketing/plan";
import { loadMarketingSettings } from "@/lib/marketing/settings";
import { recommendedService, serviceDefinition } from "@/lib/services";

/**
 * The marketing Studio's work (topic ideas, posts, personal follow-ups),
 * for the admin page and the MCP plug (docs/MCP.md). Nothing is sent or
 * published here; the callers check the session.
 */

const channel = z.enum(Object.keys(CHANNELS) as [keyof typeof CHANNELS, ...Array<keyof typeof CHANNELS>]);
const pillar = z.enum(Object.keys(ALL_PILLARS) as [keyof typeof ALL_PILLARS, ...Array<keyof typeof ALL_PILLARS>]);
const format = z.enum(Object.keys(FORMATS) as [keyof typeof FORMATS, ...Array<keyof typeof FORMATS>]);
const destination = z.enum(Object.keys(ALL_DESTINATIONS) as [keyof typeof ALL_DESTINATIONS, ...Array<keyof typeof ALL_DESTINATIONS>]);
const id = z.coerce.number().int().positive();

export type StudioVariant = Variant & { code: string; link: string; destination: keyof typeof ALL_DESTINATIONS };

/** A pillar and a destination belong to one audience: an IA post never links to the CISSP scanner. */
function audienceError(kind: MarketingKind, p: string, dest: string): string | null {
  if (!(p in pillarsFor(kind))) return "Ce pilier ne correspond pas à ce programme : rechargez la page.";
  if (!(dest in destinationsFor(kind))) return "Cette destination ne correspond pas à ce programme : rechargez la page.";
  return null;
}

/**
 * Ten subject ideas (Ben, 29/09): from what prospects say and do, what was
 * already published this month, and, when asked, the news found on the web.
 */
export async function topicIdeas(input: { cohortId: number; withNews: boolean }): Promise<{ ok: true; ideas: TopicIdea[]; news: NewsItem[]; newsError: string | null } | { ok: false; error: string }> {
  const parsed = z.object({ cohortId: id, withNews: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  const settings = await loadMarketingSettings();
  const cohort = await prisma.cohort.findUnique({ where: { id: parsed.data.cohortId }, select: { program: true } });
  if (!cohort) return { ok: false, error: "Cohorte introuvable." };
  const kind = marketingKind(cohort.program);
  const [facts, tests, insights, recent, news] = await Promise.all([
    cohortFacts(parsed.data.cohortId),
    recentTestStats(settings.testThreshold),
    audienceInsights(new Date(), kind),
    recentPosts(new Date(), kind),
    parsed.data.withNews ? searchNews(kind) : Promise.resolve(null),
  ]);
  if (!facts) return { ok: false, error: "Cohorte introuvable." };
  const newsItems = news?.ok ? news.items : [];
  const result = await suggestTopics({
    kind,
    facts: factsForModel(facts, tests.stats),
    insights,
    recent: recent.map((p) => `- ${ALL_PILLARS[pillarOf(p, kind)].label} · ${p.format ?? "standard"} · ${p.topic ?? p.text.split("\n")[0].slice(0, 120)}`).join("\n"),
    news: newsItems.map((n) => `- ${n.title} (${n.date}) — ${n.url} — ${n.why}`).join("\n"),
  });
  if (!result.ok) return result;
  return { ok: true, ideas: result.ideas, news: newsItems, newsError: news && !news.ok ? news.error : null };
}

/** Three variants for a channel, a pillar, a format and a subject, each with its own tracked link. */
export async function generateStudioPosts(input: { cohortId: number; channel: string; pillar: string; format: string; topic: string; destination: string; brief: string }): Promise<{ ok: true; variants: StudioVariant[] } | { ok: false; error: string }> {
  const parsed = z.object({ cohortId: id, channel, pillar, format, topic: z.string().trim().max(600), destination, brief: z.string().trim().max(1200) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choisissez un canal, un pilier, un format et une destination." };
  const d = parsed.data;
  if (!(FORMATS[d.format].channels as readonly string[]).includes(d.channel)) return { ok: false, error: `Le format « ${FORMATS[d.format].label} » ne convient pas à ${CHANNELS[d.channel].label}.` };
  if (d.destination === "test" && !examBootEnabled()) return { ok: false, error: "Le test d'entraînement n'est pas activé sur le site : choisissez une autre destination." };
  if (!d.topic && !d.brief) return { ok: false, error: "Donnez un sujet (ou choisissez une idée), ou écrivez ce que vous voulez dire." };
  const settings = await loadMarketingSettings();
  const [facts, tests] = await Promise.all([cohortFacts(d.cohortId), recentTestStats(settings.testThreshold)]);
  if (!facts) return { ok: false, error: "Cohorte introuvable." };
  const kind = marketingKind(facts.program);
  const mismatch = audienceError(kind, d.pillar, d.destination);
  if (mismatch) return { ok: false, error: mismatch };
  const result = await generateVariants({ kind, facts: factsForModel(facts, kind === "ia" ? null : tests.stats), channel: d.channel, pillar: d.pillar, format: d.format, topic: d.topic, destination: d.destination, brief: d.brief });
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

export const saveSchema = z.object({
  cohortId: id,
  channel,
  pillar,
  format,
  topic: z.string().trim().max(240),
  destination,
  code: z.string().regex(POST_CODE_PATTERN),
  text: z.string().trim().min(10).max(6000),
  visual: z.object({ format: z.string(), scene: z.string(), onScreenText: z.string(), direction: z.string(), imagePrompt: z.string().max(2000).optional() }),
  video: z.object({ scenes: z.array(z.object({ seconds: z.number(), image: z.string(), voiceover: z.string(), onScreen: z.string() })), minimaxPrompt: z.string() }).nullable(),
});

/** Keeps a variant (as Ben edited it) in the cohort's library. */
export async function saveStudioPost(input: z.input<typeof saveSchema>): Promise<{ ok: boolean; error?: string }> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Contenu invalide." };
  const d = parsed.data;
  const cohort = await prisma.cohort.findUnique({ where: { id: d.cohortId }, select: { program: true } });
  if (!cohort) return { ok: false, error: "Cohorte introuvable." };
  const mismatch = audienceError(marketingKind(cohort.program), d.pillar, d.destination);
  if (mismatch) return { ok: false, error: mismatch };
  await prisma.marketingPost.upsert({
    where: { code: d.code },
    create: { cohortId: d.cohortId, channel: d.channel, angle: d.pillar, pillar: d.pillar, format: d.format, topic: d.topic || null, destination: d.destination, code: d.code, text: d.text, visualBrief: JSON.stringify(d.visual), video: d.video && d.video.scenes.length ? JSON.stringify(d.video) : null },
    update: { text: d.text },
  });
  return { ok: true };
}

const SEGMENT_REASON: Record<SegmentKey, string> = {
  called: "Elle a fait l'appel découverte avec Ben mais ne s'est pas inscrite.",
  test_high: "Bon score au test d'entraînement, sans place réservée : elle peut viser l'examen plus vite avec la méthode et le rythme du bootcamp.",
  test_low: "Score au test d'entraînement sous le seuil, sans place réservée : le bootcamp travaille justement ces angles morts, avec un coach.",
  hot: "Profil chaud (forte intention), pas encore testé : le test de 5 questions est le prochain pas naturel.",
  associate: "Profil éligible via le titre Associate of ISC² : elle peut passer l'examen dès maintenant.",
  conseil: "Son échéance est plus courte que le délai estimé par l'analyse : un échange de conseil d'abord, pour bâtir un plan réaliste.",
  cc: "Profil qui débute : la bonne première marche est la certification CC d'ISC², ou un bilan de carrière.",
  ia_ready: "Elle a fait le diagnostic d'automatisation et se dit à l'aise avec l'ordinateur, sans s'inscrire : elle peut démarrer directement à la J1.",
  ia_prepare: "Elle a fait le diagnostic d'automatisation sans s'inscrire et a besoin d'aide avec l'ordinateur : une séance d'accueil d'une heure avant la J1 installe les outils avec elle.",
};

const segmentKey = z.enum(["called", "test_high", "test_low", "hot", "associate", "conseil", "cc", "ia_ready", "ia_prepare"]);
const isIaSegment = (s: SegmentKey) => (IA_SEGMENTS as readonly string[]).includes(s);

/** A personal follow-up for one consenting prospect. Nothing is sent here. */
export async function draftLeadFollowup(input: { leadId: number; cohortId: number; channel: "whatsapp" | "email"; segment: string }): Promise<{ ok: true; text: string; subject: string | null } | { ok: false; error: string }> {
  const parsed = z.object({ leadId: id, cohortId: id, channel: z.enum(["whatsapp", "email"]), segment: segmentKey }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  if (isIaSegment(parsed.data.segment)) return draftIaFollowup(parsed.data as { leadId: number; cohortId: number; channel: "whatsapp" | "email"; segment: SegmentKey });
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

/**
 * A personal follow-up after the automation diagnostic (Ben, 04/11). The
 * link opens the inscription with the person already known and the entry
 * preselected. Nothing is sent here.
 */
async function draftIaFollowup(input: { leadId: number; cohortId: number; channel: "whatsapp" | "email"; segment: SegmentKey }): Promise<{ ok: true; text: string; subject: string | null } | { ok: false; error: string }> {
  const [lead, facts] = await Promise.all([
    prisma.lead.findUnique({ where: { id: input.leadId }, include: { iaDiagnostics: { orderBy: { createdAt: "desc" }, take: 1, select: { token: true, answers: true, result: true } } } }),
    cohortFacts(input.cohortId),
  ]);
  if (!lead || !facts) return { ok: false, error: "Introuvable." };
  if (facts.program !== "ia") return { ok: false, error: "Choisissez une entrée du Bâtisseur IA pour cette relance." };
  if (!lead.consentAt || lead.unsubscribedAt) return { ok: false, error: "Cette personne n'a pas accepté d'être recontactée." };
  const diagnostic = lead.iaDiagnostics[0];
  if (!diagnostic) return { ok: false, error: "Pas de diagnostic pour cette personne." };
  const answers = (diagnostic.answers ?? {}) as { activity?: keyof typeof ACTIVITIES; tasks?: Array<keyof typeof TASKS>; hours?: keyof typeof HOURS; tools?: keyof typeof TOOLS };
  const result = (diagnostic.result ?? {}) as Partial<IaDiagnosis>;
  const person = [
    `Prénom : ${lead.firstName}`,
    `Pays : ${lead.country}`,
    answers.activity && ACTIVITIES[answers.activity] ? `Activité : ${ACTIVITIES[answers.activity]}` : null,
    answers.tasks?.length ? `Tâches qui lui prennent du temps : ${answers.tasks.map((t) => TASKS[t]?.label).filter(Boolean).join(", ")}` : null,
    answers.hours && HOURS[answers.hours] ? `Temps déclaré sur ces tâches : ${HOURS[answers.hours].toLowerCase()} par semaine` : null,
    answers.tools && TOOLS[answers.tools] ? `Outils actuels : ${TOOLS[answers.tools]}` : null,
    result.priorities?.length ? `Première automatisation conseillée : ${result.priorities[0].title}` : null,
  ].filter(Boolean).join("\n");
  const offer = input.segment === "ia_prepare"
    ? `Sa place pour l'${facts.name.charAt(0).toLowerCase()}${facts.name.slice(1)}, avec une séance d'accueil d'une heure avant la J1 pour installer les outils ensemble.`
    : `Sa place pour l'${facts.name.charAt(0).toLowerCase()}${facts.name.slice(1)} : elle peut démarrer directement à la J1.`;
  const link = iaUrl(`/ia/inscription?t=${diagnostic.token}&entree=${facts.id}`, env.NEXT_PUBLIC_APP_URL);
  const draft = await draftFollowup({ kind: "ia", facts: factsForModel(facts), channel: input.channel, person, segment: SEGMENT_REASON[input.segment], offer, link: "l'inscription au Bâtisseur IA, avec ses coordonnées déjà reconnues et cette date d'entrée présélectionnée ; paiement par carte ou mobile money" });
  if (!draft.ok) return draft;
  let text = withLink(draft.text, link);
  let subject: string | null = null;
  const match = /^Objet\s*:\s*(.+)\n+/i.exec(text);
  if (match) {
    subject = match[1].trim();
    text = text.slice(match[0].length);
  }
  return { ok: true, text, subject: input.channel === "email" ? subject ?? `${lead.firstName}, votre application avec le Bâtisseur IA` : null };
}

