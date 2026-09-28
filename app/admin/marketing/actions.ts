"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { draftFollowup, generateVariants, type Variant } from "@/lib/marketing/ai";
import { cohortFacts, factsForModel } from "@/lib/marketing/data";
import { ANGLES, CHANNELS, newPostCode, trackedLink, withLink } from "@/lib/marketing/plan";
import { sendEmail } from "@/lib/messaging/email";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Non autorisé");
}

const channel = z.enum(Object.keys(CHANNELS) as [keyof typeof CHANNELS, ...Array<keyof typeof CHANNELS>]);
const angle = z.enum(Object.keys(ANGLES) as [keyof typeof ANGLES, ...Array<keyof typeof ANGLES>]);
const id = z.coerce.number().int().positive();

export type StudioVariant = Variant & { code: string; link: string };

/** Three variants for a channel and an angle, each with its own tracked link. */
export async function generatePosts(input: { cohortId: number; channel: string; angle: string; brief: string }): Promise<{ ok: true; variants: StudioVariant[] } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = z.object({ cohortId: id, channel, angle, brief: z.string().trim().max(600) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Choisissez une cohorte, un canal et un angle." };
  const facts = await cohortFacts(parsed.data.cohortId);
  if (!facts) return { ok: false, error: "Cohorte introuvable." };
  const result = await generateVariants({ facts: factsForModel(facts), channel: parsed.data.channel, angle: parsed.data.angle, brief: parsed.data.brief });
  if (!result.ok) return result;
  return {
    ok: true,
    variants: result.variants.map((v) => {
      const code = newPostCode(parsed.data.channel);
      const link = trackedLink(env.NEXT_PUBLIC_APP_URL, parsed.data.channel, facts.id, code);
      return { ...v, code, link, text: withLink(v.text, link) };
    }),
  };
}

const saveSchema = z.object({
  cohortId: id,
  channel,
  angle,
  code: z.string().regex(/^[a-z]{2}-[a-f0-9]{6}$/),
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
    create: { cohortId: d.cohortId, channel: d.channel, angle: d.angle, code: d.code, text: d.text, visualBrief: JSON.stringify(d.visual), video: d.video && d.video.scenes.length ? JSON.stringify(d.video) : null },
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

const SEGMENT_REASON: Record<string, string> = {
  called: "Elle a fait l'appel découverte avec Ben mais ne s'est pas inscrite.",
  hot: "Profil chaud (forte intention) sans place réservée.",
  associate: "Profil éligible via le titre Associate of ISC² : elle peut passer l'examen dès maintenant.",
  cc: "Profil qui débute : la bonne première marche est la certification CC d'ISC².",
};

/** A personal follow-up for one consenting prospect. Nothing is sent here. */
export async function draftFollowupFor(input: { leadId: number; cohortId: number; channel: "whatsapp" | "email"; segment: string }): Promise<{ ok: true; text: string; subject: string | null } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = z.object({ leadId: id, cohortId: id, channel: z.enum(["whatsapp", "email"]), segment: z.enum(["called", "hot", "associate", "cc"]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Demande invalide." };
  const [lead, facts] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: parsed.data.leadId },
      include: { scannerResponses: { orderBy: { createdAt: "desc" }, take: 1, select: { resultToken: true, analysis: true } } },
    }),
    cohortFacts(parsed.data.cohortId),
  ]);
  if (!lead || !facts) return { ok: false, error: "Introuvable." };
  if (!lead.consentAt || lead.unsubscribedAt) return { ok: false, error: "Cette personne n'a pas accepté d'être recontactée." };
  const analysis = lead.scannerResponses[0]?.analysis as { headline?: string; timeline?: { label?: string } } | undefined;
  const person = [
    `Prénom : ${lead.firstName}`,
    lead.jobTitle ? `Poste : ${lead.jobTitle}` : null,
    `Pays : ${lead.country}`,
    lead.readiness ? `Verdict de l'analyse : ${lead.readiness}${analysis?.headline ? ` — ${analysis.headline}` : ""}` : null,
    analysis?.timeline?.label ? `Délai estimé, accompagné : ${analysis.timeline.label}` : null,
    lead.goals ? `Ses objectifs, écrits par elle : « ${lead.goals} »` : null,
  ].filter(Boolean).join("\n");
  const result = await draftFollowup({ facts: factsForModel(facts), channel: parsed.data.channel, person, segment: SEGMENT_REASON[parsed.data.segment] });
  if (!result.ok) return result;
  const token = lead.scannerResponses[0]?.resultToken;
  const link = token ? `${env.NEXT_PUBLIC_APP_URL}/scanner/resultat/${token}` : trackedLink(env.NEXT_PUBLIC_APP_URL, "whatsapp_status", facts.id, "relance");
  let text = withLink(result.text, link);
  let subject: string | null = null;
  const match = /^Objet\s*:\s*(.+)\n+/i.exec(text);
  if (match) {
    subject = match[1].trim();
    text = text.slice(match[0].length);
  }
  return { ok: true, text, subject: parsed.data.channel === "email" ? subject ?? `${lead.firstName}, votre place pour la ${facts.name}` : null };
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
