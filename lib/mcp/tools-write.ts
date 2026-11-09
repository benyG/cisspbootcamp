import { z } from "zod/v4";

import { createAdCampaign, setAdActive, setAdSpend } from "@/lib/admin-ops/ads";
import { markBetDone, setBetDecision } from "@/lib/admin-ops/analyst";
import { createCohort, markCampaignDone, updateCohort } from "@/lib/admin-ops/cohorts";
import { CALL_OUTCOMES, type OpResult, appendLeadNote, markLeadLost, markUnfinishedHandled, postponeFollowup, recordCallOutcome, recordFollowupSent, updateLeadFields } from "@/lib/admin-ops/leads";
import { createPartnerCode, createReferralCodes, setPromoActive } from "@/lib/admin-ops/promos";
import { AD_CHANNEL_IDS, AD_DESTINATIONS } from "@/lib/ads";
import { analystWeekKey } from "@/lib/analyst/rules";
import { generateAnalysis } from "@/lib/analyst/server";
import { MANUAL_COHORT_STATUSES } from "@/lib/cohorts";
import { prisma } from "@/lib/db";
import { sendAdminTestEmail } from "@/lib/health/test-email";
import { ALL_DESTINATIONS, ALL_PILLARS, CHANNELS, FORMATS } from "@/lib/marketing/plan";
import { planPost, scheduleDay } from "@/lib/marketing/schedule";
import { draftLeadFollowup, generateStudioPosts, topicIdeas } from "@/lib/marketing/studio";
import { PLAYBOOK_IDS, PLAYBOOKS, MODES } from "@/lib/playbooks/rules";
import { saveMode } from "@/lib/playbooks/server";
import { PROGRAM_CODES } from "@/lib/programs";
import { MAX_PERCENT } from "@/lib/promo";
import { holdSeat, releaseHold } from "@/lib/seat-holds";

import { type ToolDef, ToolError, defineTool } from "./protocol";

/**
 * Lot 2 of the MCP plug (docs/MCP.md): reversible actions, applied at once
 * and journaled. Each calls the same code as the admin button. Nothing here
 * pays, deletes, publishes now or writes to a prospect, with one stated
 * exception: a call outcome sends the after-call e-mail, as the admin does.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date au format AAAA-MM-JJ");
const done = (r: OpResult) => {
  if (!r.ok) throw new ToolError(r.error);
  return r;
};

export const updateLead = defineTool({
  name: "update_lead",
  title: "Mettre à jour un prospect",
  description: "Change la fiche d'un prospect : ajouter une note datée (addNote) ou remplacer les notes, étiquettes, statut, date de prochaine relance (ou « aucune »), reporter la relance de 2 jours. Le statut « lost » arrête les relances. « registered » n'est accepté qu'avec une place payée.",
  level: "write",
  input: z.object({
    leadId: z.number().int().positive(),
    addNote: z.string().trim().min(1).max(1000).optional().describe("Ligne datée ajoutée sous les notes existantes"),
    notes: z.string().max(5000).optional().describe("Remplace toutes les notes (rarement utile)"),
    tags: z.array(z.string().trim().min(1).max(40)).max(15).optional(),
    status: z.enum(["new", "contacted", "booked", "called", "registered", "nurture", "lost"]).optional(),
    nextFollowup: z.union([day, z.literal("aucune")]).optional().describe("Jour de la prochaine relance, ou « aucune »"),
    postpone: z.boolean().optional().describe("Reporter la relance due de 2 jours"),
  }),
  run: async ({ leadId, addNote, notes, tags, status, nextFollowup, postpone }, { now }) => {
    const messages: string[] = [];
    if (status === "lost") messages.push(done(await markLeadLost(leadId)).message);
    const patch = {
      ...(status && status !== "lost" ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(tags ? { tags } : {}),
      ...(nextFollowup ? { nextFollowupAt: nextFollowup === "aucune" ? null : new Date(`${nextFollowup}T08:00:00Z`) } : {}),
    };
    if (Object.keys(patch).length) messages.push(done(await updateLeadFields(leadId, patch)).message);
    if (addNote) messages.push(done(await appendLeadNote(leadId, addNote, now)).message);
    if (postpone) messages.push(done(await postponeFollowup(leadId, now)).message);
    if (!messages.length) throw new ToolError("Rien à changer : donnez au moins un champ.");
    return { ok: true, fait: messages };
  },
});

export const recordCallOutcomeTool = defineTool({
  name: "record_call_outcome",
  title: "Résultat d'un appel",
  description: "Enregistre le résultat d'un appel découverte ou d'une séance (bookingId, voir upcoming_calls ou get_lead) : registered (veut s'inscrire), to_follow_up (à relancer), not_now (pas maintenant : relance dans 90 jours), not_qualified (perdu), no_show (absent). Comme le bouton de l'admin, « registered » et « to_follow_up » envoient au prospect l'e-mail d'après-appel avec le lien de paiement : à faire seulement sur instruction claire de Ben.",
  level: "write",
  input: z.object({ bookingId: z.number().int().positive(), outcome: z.enum(CALL_OUTCOMES) }),
  run: async ({ bookingId, outcome }, { now }) => done(await recordCallOutcome(bookingId, outcome, now)),
});

export const markFollowupDone = defineTool({
  name: "mark_followup_done",
  title: "Relance faite",
  description: "Note qu'une relance a été envoyée à la main par Ben (leadId + channel whatsapp ou email) : la séquence passe à la suivante. Ou retire de la file une inscription inachevée traitée (unfinishedRegistrationId). N'envoie rien.",
  level: "write",
  input: z.object({
    leadId: z.number().int().positive().optional(),
    channel: z.enum(["whatsapp", "email"]).optional(),
    unfinishedRegistrationId: z.number().int().positive().optional(),
  }),
  run: async ({ leadId, channel, unfinishedRegistrationId }, { now }) => {
    if (unfinishedRegistrationId) return done(await markUnfinishedHandled(unfinishedRegistrationId));
    if (!leadId || !channel) throw new ToolError("Donnez leadId et channel, ou unfinishedRegistrationId.");
    return done(await recordFollowupSent(leadId, channel, now));
  },
});

export const seatHold = defineTool({
  name: "seat_hold",
  title: "Garder ou libérer une place",
  description: "Garde une place 48 h pour un prospect après l'appel (action hold, leadId), ou libère une place gardée (action release, holdId, visible dans get_lead ou action_queue).",
  level: "write",
  input: z.object({ action: z.enum(["hold", "release"]), leadId: z.number().int().positive().optional(), holdId: z.number().int().positive().optional() }),
  run: async ({ action, leadId, holdId }, { now }) => {
    if (action === "hold") {
      if (!leadId) throw new ToolError("leadId requis pour garder une place.");
      const r = await holdSeat(leadId, now);
      if (!r.ok) throw new ToolError(r.error);
      return { ok: true, message: "Place gardée 48 h.", detail: r };
    }
    if (!holdId) throw new ToolError("holdId requis pour libérer une place.");
    const hold = await prisma.seatHold.findUnique({ where: { id: holdId }, select: { releasedAt: true } });
    if (!hold) throw new ToolError(`Aucune place gardée n°${holdId}.`);
    if (hold.releasedAt) return { ok: true, message: "Cette place était déjà libérée." };
    await releaseHold(holdId, "manual", now);
    return { ok: true, message: "Place libérée." };
  },
});

const SEGMENTS = ["called", "test_high", "test_low", "hot", "associate", "conseil", "cc", "ia_ready", "ia_prepare"] as const;

export const draftFollowupTool = defineTool({
  name: "draft_followup",
  title: "Rédiger une relance",
  description: "Rédige (IA) une relance personnelle pour un prospect qui a donné son accord, à partir de sa fiche, avec le bon lien. N'envoie rien : Ben la relit et l'envoie lui-même. segment : called (appel fait, pas inscrit), test_high / test_low (score au test), hot (profil chaud), associate, conseil, cc, ia_ready / ia_prepare (Bâtisseur IA).",
  level: "write",
  input: z.object({ leadId: z.number().int().positive(), cohortId: z.number().int().positive().describe("Cohorte proposée (list_cohorts)"), channel: z.enum(["whatsapp", "email"]), segment: z.enum(SEGMENTS) }),
  run: async (args) => {
    const r = await draftLeadFollowup(args);
    if (!r.ok) throw new ToolError(r.error);
    return { objet: r.subject, message: r.text, rappel: "Brouillon seulement : rien n'a été envoyé." };
  },
});

export const suggestPostTopics = defineTool({
  name: "suggest_post_topics",
  title: "Idées de sujets",
  description: "Dix idées de sujets de posts pour une cohorte (IA), tirées de ce que disent et font les prospects et de ce qui a déjà été publié ; avec l'actualité du web si withNews. Rien n'est enregistré.",
  level: "write",
  input: z.object({ cohortId: z.number().int().positive(), withNews: z.boolean().default(false) }),
  run: async (args) => {
    const r = await topicIdeas(args);
    if (!r.ok) throw new ToolError(r.error);
    return { idees: r.ideas, actualites: r.news, erreurActualites: r.newsError };
  },
});

const keys = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...Array<keyof T & string>];

export const generatePosts = defineTool({
  name: "generate_posts",
  title: "Générer des posts",
  description: "Écrit (IA) trois variantes de post pour une cohorte, chacune avec son lien suivi, et les range en brouillons à valider dans Admin › Marketing (comme les propositions du rythme de contenu). Rien n'est publié. Voir suggest_post_topics pour les sujets. Le pilier et la destination doivent correspondre au programme (CISSP/CC ou Bâtisseur IA).",
  level: "write",
  input: z.object({
    cohortId: z.number().int().positive(),
    channel: z.enum(keys(CHANNELS)).default("linkedin"),
    pillar: z.enum(keys(ALL_PILLARS)),
    format: z.enum(keys(FORMATS)).default("standard"),
    destination: z.enum(keys(ALL_DESTINATIONS)),
    topic: z.string().trim().max(600).default(""),
    brief: z.string().trim().max(1200).default("").describe("Ce que Ben veut dire, en quelques phrases"),
  }),
  run: async (args) => {
    const r = await generateStudioPosts(args);
    if (!r.ok) throw new ToolError(r.error);
    const saved = [];
    for (const v of r.variants) {
      const post = await prisma.marketingPost.create({
        data: { cohortId: args.cohortId, channel: args.channel, angle: args.pillar, pillar: args.pillar, format: args.format, topic: args.topic || v.title || null, destination: v.destination, code: v.code, text: v.text, visualBrief: JSON.stringify(v.visual), video: v.video?.scenes?.length ? JSON.stringify(v.video) : null, autoDraft: true },
        select: { id: true },
      });
      saved.push({ postId: post.id, titre: v.title, lien: v.link, texte: v.text });
    }
    return { message: `${saved.length} brouillons rangés dans Admin › Marketing, à valider.`, brouillons: saved };
  },
});

export const editPost = defineTool({
  name: "edit_post",
  title: "Modifier un post",
  description: "Remplace le texte d'un post pas encore publié. Le lien suivi du post doit rester dans le texte (sinon ses visites ne sont plus comptées).",
  level: "write",
  input: z.object({ postId: z.number().int().positive(), text: z.string().trim().min(10).max(6000) }),
  run: async ({ postId, text }) => {
    const post = await prisma.marketingPost.findUnique({ where: { id: postId }, select: { code: true, publishedAt: true, linkedinUrn: true } });
    if (!post) throw new ToolError(`Aucun post n°${postId}.`);
    if (post.publishedAt || post.linkedinUrn) throw new ToolError("Ce post est déjà publié : il ne se modifie plus ici.");
    if (!text.includes(post.code)) throw new ToolError(`Gardez le lien suivi du post dans le texte (il contient « ${post.code} »).`);
    await prisma.marketingPost.update({ where: { id: postId }, data: { text } });
    return { ok: true, message: "Texte du post mis à jour." };
  },
});

export const schedulePost = defineTool({
  name: "schedule_post",
  title: "Programmer un post LinkedIn",
  description: "Programme un post LinkedIn (brouillon ou post gardé) pour un jour : la tâche quotidienne le publie ce jour-là sur le profil de Ben. day vide ou null le retire du planning. Annulable jusqu'au jour J. Ne programmer que ce que Ben a relu et approuvé.",
  level: "write",
  input: z.object({ postId: z.number().int().positive(), day: day.nullable().describe("AAAA-MM-JJ, aujourd'hui ou plus tard ; null pour déprogrammer") }),
  run: async ({ postId, day: value }, { now }) => {
    if (value === null) return done(await planPost(postId, null));
    const at = scheduleDay(value, now);
    if (!at) throw new ToolError("Date passée ou invalide.");
    return done(await planPost(postId, at));
  },
});

export const promoCodes = defineTool({
  name: "promo_codes",
  title: "Codes promo",
  description: `Crée un code partenaire (create_partner : code, label, percent 1-${MAX_PERCENT}, programme ou tous, date de fin, nombre d'utilisations), crée les codes de parrainage des anciens d'un programme (create_referrals : program, percent), ou active / désactive un code (activate / deactivate : code). La remise s'applique au paiement par carte en une fois.`,
  level: "write",
  input: z.object({
    action: z.enum(["create_partner", "create_referrals", "activate", "deactivate"]),
    code: z.string().trim().max(24).optional(),
    label: z.string().trim().max(120).optional().describe("Nom du partenaire"),
    percent: z.number().int().min(1).max(MAX_PERCENT).optional(),
    program: z.enum(PROGRAM_CODES).optional().describe("Vide = tous les programmes"),
    validUntil: day.optional(),
    maxUses: z.number().int().min(1).max(10_000).optional(),
  }),
  run: async ({ action, code, label, percent, program, validUntil, maxUses }, { now }) => {
    if (action === "create_partner") return done(await createPartnerCode({ code: code ?? "", label: label ?? "", percent: percent ?? 0, program: program ?? null, validUntil: validUntil ? new Date(`${validUntil}T00:00:00Z`) : null, maxUses: maxUses ?? null }));
    if (action === "create_referrals") {
      if (!program || !percent) throw new ToolError("program et percent requis.");
      return done(await createReferralCodes(program, percent, now));
    }
    if (!code) throw new ToolError("code requis.");
    return done(await setPromoActive({ code: code.toUpperCase() }, action === "activate"));
  },
});

export const adCampaigns = defineTool({
  name: "ad_campaigns",
  title: "Pub payante",
  description: "Déclare une campagne payante et obtient son lien suivi (create : name, channel, destination, cohortId, budgetUsd), met à jour la dépense lue dans l'outil de pub (set_spend : campaignId, spentUsd), ou la termine / réactive (end / reactivate : campaignId). Les identifiants sont dans ads_and_promos.",
  level: "write",
  input: z.object({
    action: z.enum(["create", "set_spend", "end", "reactivate"]),
    campaignId: z.number().int().positive().optional(),
    name: z.string().trim().max(80).optional(),
    channel: z.enum(AD_CHANNEL_IDS as [string, ...string[]]).optional(),
    destination: z.enum(keys(AD_DESTINATIONS)).optional(),
    cohortId: z.number().int().positive().optional(),
    budgetUsd: z.number().int().min(1).max(100_000).optional(),
    spentUsd: z.number().min(0).max(1_000_000).optional(),
  }),
  run: async ({ action, campaignId, name, channel, destination, cohortId, budgetUsd, spentUsd }, { now }) => {
    if (action === "create") return done(await createAdCampaign({ name, channel, destination, cohortId: cohortId ?? null, budgetUsd: budgetUsd ?? null }));
    if (!campaignId) throw new ToolError("campaignId requis.");
    if (action === "set_spend") {
      if (spentUsd === undefined) throw new ToolError("spentUsd requis.");
      return done(await setAdSpend(campaignId, Math.round(spentUsd * 100), now));
    }
    return done(await setAdActive(campaignId, action === "reactivate"));
  },
});

export const cohorts = defineTool({
  name: "cohorts",
  title: "Cohortes",
  description: "Crée une cohorte (create : program, name, startsAt, endsAt sauf CISSP calculé, capacity, targetSeats, status planned ou open), la modifie (update : cohortId + tous les champs ; une cohorte commencée ne change que de nom), ou coche une étape de son plan de campagne (campaign_step_done : cohortId, stepKey vu dans action_queue). Ne supprime rien.",
  level: "write",
  input: z.object({
    action: z.enum(["create", "update", "campaign_step_done"]),
    cohortId: z.number().int().positive().optional(),
    program: z.enum(PROGRAM_CODES).optional(),
    name: z.string().trim().max(120).optional(),
    startsAt: day.optional(),
    endsAt: day.optional(),
    capacity: z.number().int().min(1).max(100).optional(),
    targetSeats: z.number().int().min(1).max(100).optional(),
    status: z.enum(MANUAL_COHORT_STATUSES).optional(),
    stepKey: z.string().max(40).optional(),
  }),
  run: async ({ action, cohortId, stepKey, ...fields }, { now }) => {
    if (action === "campaign_step_done") {
      if (!cohortId || !stepKey) throw new ToolError("cohortId et stepKey requis.");
      return done(await markCampaignDone(cohortId, stepKey));
    }
    if (action === "create") return done(await createCohort({ ...fields, program: fields.program ?? "cissp" }, null, now));
    if (!cohortId) throw new ToolError("cohortId requis.");
    const current = await prisma.cohort.findUnique({ where: { id: cohortId } });
    if (!current) throw new ToolError(`Aucune cohorte n°${cohortId}.`);
    const merged = {
      program: fields.program ?? current.program,
      name: fields.name ?? current.name,
      startsAt: fields.startsAt ?? current.startsAt,
      endsAt: fields.endsAt ?? current.endsAt,
      capacity: fields.capacity ?? current.capacity,
      targetSeats: fields.targetSeats ?? current.targetSeats,
      status: fields.status ?? ((MANUAL_COHORT_STATUSES as readonly string[]).includes(current.status) ? current.status : "open"),
    };
    return done(await updateCohort(cohortId, merged, now));
  },
});

export const setPlaybookMode = defineTool({
  name: "set_playbook_mode",
  title: "Mode d'un playbook",
  description: `Passe un playbook en on (actif : il agit seul), trial (essai : il montre ce qu'il ferait, sans rien faire) ou off. Playbooks : ${PLAYBOOK_IDS.map((id) => `${id} (${PLAYBOOKS[id].title})`).join(", ")}.`,
  level: "write",
  input: z.object({ playbook: z.enum(PLAYBOOK_IDS), mode: z.enum(MODES) }),
  run: async ({ playbook, mode }) => {
    await saveMode(playbook, mode);
    return { ok: true, message: `${PLAYBOOKS[playbook].title} : ${mode === "on" ? "actif" : mode === "trial" ? "en essai" : "arrêté"}.` };
  },
});

export const analystDecision = defineTool({
  name: "analyst",
  title: "Décisions de l'analyste",
  description: "Retient (keep : l'orientation va dans la file d'actions), écarte (drop) ou efface la décision (clear) d'une orientation de l'analyste (week, rank ; voir analyst_report), la marque faite (done), ou relance l'analyse de la semaine (run : environ une minute, remet les décisions de la semaine à zéro).",
  level: "write",
  input: z.object({ action: z.enum(["keep", "drop", "clear", "done", "run"]), week: day.optional().describe("Lundi de la semaine ; vide = semaine en cours"), rank: z.number().int().min(1).max(3).optional() }),
  run: async ({ action, week, rank }, { now }) => {
    if (action === "run") {
      const r = await generateAnalysis(now);
      if (!r.ok) throw new ToolError(r.error);
      return { ok: true, message: `Analyse faite : ${r.bets} orientation(s). Lisez-la avec analyst_report.`, semaine: r.weekKey, chiffresRetires: r.removed };
    }
    if (!rank) throw new ToolError("rank requis.");
    const key = week ?? analystWeekKey(now);
    if (action === "done") return done(await markBetDone(key, rank));
    return done(await setBetDecision(key, rank, action === "keep" ? "kept" : action === "drop" ? "dropped" : null, now));
  },
});

export const sendTestEmail = defineTool({
  name: "send_test_email",
  title: "E-mail de test",
  description: "Envoie un e-mail de test à l'adresse de Ben (et à personne d'autre), pour vérifier que les e-mails partent.",
  level: "write",
  input: z.object({}),
  run: async () => {
    const r = await sendAdminTestEmail("la prise MCP");
    if (!r.ok) throw new ToolError(r.message);
    return r;
  },
});

export const WRITE_TOOLS: readonly ToolDef[] = [updateLead, recordCallOutcomeTool, markFollowupDone, seatHold, draftFollowupTool, suggestPostTopics, generatePosts, editPost, schedulePost, promoCodes, adCampaigns, cohorts, setPlaybookMode, analystDecision, sendTestEmail];
