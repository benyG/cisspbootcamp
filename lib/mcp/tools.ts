import { z } from "zod/v4";

import { loadQueue } from "@/lib/action-queue";
import { loadAdCampaigns } from "@/lib/ads-server";
import { AD_CHANNELS, VERDICT_LABEL, usdCents, verdictText } from "@/lib/ads";
import { CONFIDENCE, readDecisions } from "@/lib/analyst/rules";
import { analystReport } from "@/lib/analyst/server";
import { listSlots } from "@/lib/booking";
import { admissionClosesAt } from "@/lib/cohorts";
import { listCohortsWithGauge } from "@/lib/cohorts-admin";
import { prisma } from "@/lib/db";
import { runAllChecks, summary } from "@/lib/health/checks";
import { forecastSentence, stateLabel } from "@/lib/pilotage";
import { cohortTitle, loadPilotCohorts, topPosts } from "@/lib/pilotage-server";
import { PROGRAMS, type ProgramCode } from "@/lib/programs";
import { tunnelReport } from "@/lib/tracking/report";

import { type ToolDef, ToolError, defineTool } from "./protocol";

/**
 * The tools of the MCP plug (docs/MCP.md). Lot 1: reading only. Each one
 * calls what the admin page already calls; tokens and secrets never leave.
 */

const DAY_MS = 86_400_000;
const usd = (cents: number | null | undefined) => (cents == null ? null : usdCents(cents));
const programName = (p: string) => PROGRAMS[p as ProgramCode]?.name ?? p;
const fullName = (l: { firstName: string; lastName: string }) => `${l.firstName} ${l.lastName}`.trim();

const LEAD_STATUSES = ["new", "contacted", "booked", "called", "registered", "nurture", "lost"] as const;

export const pilotOverview = defineTool({
  name: "pilot_overview",
  title: "Pilotage des cohortes",
  description: "Les cohortes en campagne : places payées sur l'objectif, état par rapport à la courbe cible, prévision à la clôture, inscriptions commencées non payées, places gardées, origine des payés. Le point de départ pour savoir où en est le remplissage.",
  level: "read",
  input: z.object({}),
  run: async (_args, { now }) => {
    const cohorts = await loadPilotCohorts(now);
    return cohorts.map((c) => ({
      cohortId: c.id,
      cohorte: cohortTitle(c),
      debut: c.startsAt.toISOString().slice(0, 10),
      jour: `J${c.pilot.day}`,
      objectif: c.pilot.goal,
      placesPayees: c.pilot.paid,
      attenduesAujourdhui: c.pilot.state === "not_open" ? null : c.pilot.expected,
      etat: stateLabel(c.pilot),
      prevision: forecastSentence(c.pilot),
      rythmeParSemaine: c.pilot.weeklyPace,
      inscriptionsEnCours: c.pendingRecent,
      placesGardees: c.held,
      originePayes: c.sources,
    }));
  },
});

export const actionQueue = defineTool({
  name: "action_queue",
  title: "File d'actions du jour",
  description: "La file d'actions de l'admin, par priorité : analyses à valider, appels du jour, relances dues, paiements à confirmer, soldes, prospects chauds, places gardées, étapes de campagne, orientations de l'analyste… et les indicateurs de la semaine. Ce que Ben doit faire aujourd'hui.",
  level: "read",
  input: z.object({ limit: z.number().int().min(1).max(100).default(40).describe("Nombre maximal d'éléments") }),
  run: async ({ limit }, { now }) => {
    const { items, kpis } = await loadQueue(now);
    return { indicateurs: kpis, total: items.length, elements: items.slice(0, limit) };
  },
});

export const searchLeads = defineTool({
  name: "search_leads",
  title: "Chercher des prospects",
  description: "Cherche des prospects par nom ou e-mail, et/ou filtre par statut, chaleur minimale ou ancienneté. Renvoie l'identifiant à passer à get_lead.",
  level: "read",
  input: z.object({
    query: z.string().trim().max(80).optional().describe("Morceau de prénom, nom ou e-mail"),
    status: z.enum(LEAD_STATUSES).optional().describe("new, contacted, booked, called, registered, nurture ou lost"),
    minHeat: z.number().int().min(0).max(100).optional().describe("Chaleur minimale (0-100)"),
    sinceDays: z.number().int().min(1).max(365).optional().describe("Arrivés depuis N jours"),
    limit: z.number().int().min(1).max(50).default(20),
  }),
  run: async ({ query, status, minHeat, sinceDays, limit }, { now }) => {
    const words = (query ?? "").split(/\s+/).filter(Boolean).slice(0, 3);
    const leads = await prisma.lead.findMany({
      where: {
        AND: words.map((w) => ({ OR: [{ firstName: { contains: w } }, { lastName: { contains: w } }, { email: { contains: w } }] })),
        ...(status ? { status } : {}),
        ...(minHeat !== undefined ? { heatScore: { gte: minHeat } } : {}),
        ...(sinceDays ? { createdAt: { gte: new Date(now.getTime() - sinceDays * DAY_MS) } } : {}),
      },
      orderBy: [{ heatScore: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: { id: true, firstName: true, lastName: true, email: true, whatsapp: true, country: true, status: true, heatScore: true, readiness: true, source: true, utmSource: true, createdAt: true, nextFollowupAt: true, unsubscribedAt: true },
    });
    return leads.map((l) => ({ id: l.id, nom: fullName(l), email: l.email, whatsapp: l.whatsapp, pays: l.country, statut: l.status, chaleur: l.heatScore, preparation: l.readiness, source: l.utmSource ?? l.source, arrive: l.createdAt, prochaineRelance: l.nextFollowupAt, desinscrit: !!l.unsubscribedAt }));
  },
});

export const getLead = defineTool({
  name: "get_lead",
  title: "Fiche prospect",
  description: "La fiche complète d'un prospect : coordonnées, consentement, statut et chaleur, objectifs, dernière analyse, appels, inscriptions et paiements, diagnostics Bâtisseur IA, notes, et les 15 derniers échanges.",
  level: "read",
  input: z.object({ leadId: z.number().int().positive() }),
  run: async ({ leadId }) => {
    const l = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true, firstName: true, lastName: true, email: true, whatsapp: true, country: true, tier: true, status: true, heatScore: true, readiness: true,
        jobTitle: true, goals: true, consentAt: true, source: true, utmSource: true, utmMedium: true, utmCampaign: true, utmContent: true,
        nextFollowupAt: true, followupCount: true, notes: true, tags: true, unsubscribedAt: true, createdAt: true,
        scannerResponses: { orderBy: { createdAt: "desc" }, take: 1, select: { readiness: true, heatScore: true, status: true, analysis: true, coachMessage: true, createdAt: true, sentAt: true } },
        bookings: { orderBy: { startsAt: "desc" }, take: 10, select: { id: true, kind: true, startsAt: true, timezone: true, status: true, outcome: true, notes: true, meetUrl: true } },
        registrations: { orderBy: { createdAt: "desc" }, select: { id: true, reference: true, status: true, method: true, amountUsd: true, discountUsd: true, promoCode: true, balanceUsd: true, balancePaidAt: true, paidAt: true, paymentNote: true, createdAt: true, cohort: { select: { id: true, program: true, name: true, startsAt: true } } } },
        iaDiagnostics: { orderBy: { createdAt: "desc" }, take: 3, select: { result: true, createdAt: true } },
        actions: { orderBy: { createdAt: "desc" }, take: 15, select: { type: true, channel: true, createdAt: true } },
      },
    });
    if (!l) throw new ToolError(`Aucun prospect n°${leadId}.`);
    const scan = l.scannerResponses[0];
    return {
      id: l.id, nom: fullName(l), email: l.email, whatsapp: l.whatsapp, pays: l.country, palier: l.tier,
      statut: l.status, chaleur: l.heatScore, preparation: l.readiness, poste: l.jobTitle, objectifs: l.goals,
      consentement: l.consentAt, desinscrit: l.unsubscribedAt, arrive: l.createdAt,
      origine: { source: l.source, utm_source: l.utmSource, utm_medium: l.utmMedium, utm_campaign: l.utmCampaign, utm_content: l.utmContent },
      relance: { prochaine: l.nextFollowupAt, dejaEnvoyees: l.followupCount },
      notes: l.notes, etiquettes: l.tags,
      derniereAnalyse: scan ? { date: scan.createdAt, preparation: scan.readiness, chaleur: scan.heatScore, statut: scan.status, envoyee: scan.sentAt, analyse: scan.analysis, messageCoach: scan.coachMessage } : null,
      appels: l.bookings.map((b) => ({ id: b.id, type: b.kind, debut: b.startsAt, fuseau: b.timezone, statut: b.status, resultat: b.outcome, notes: b.notes, meet: b.meetUrl })),
      inscriptions: l.registrations.map((r) => ({
        id: r.id, reference: r.reference, cohorte: `${programName(r.cohort.program)} — ${r.cohort.name}`, cohortId: r.cohort.id, statut: r.status, moyen: r.method,
        montant: usd(r.amountUsd), remise: r.discountUsd ? usd(r.discountUsd) : null, codePromo: r.promoCode, payeLe: r.paidAt,
        solde: r.balanceUsd ? { montant: usd(r.balanceUsd), payeLe: r.balancePaidAt } : null, note: r.paymentNote,
      })),
      diagnosticsIa: l.iaDiagnostics.map((d) => ({ date: d.createdAt, resultat: d.result })),
      derniersEchanges: l.actions.map((a) => ({ type: a.type, canal: a.channel, date: a.createdAt })),
    };
  },
});

export const listCohorts = defineTool({
  name: "list_cohorts",
  title: "Cohortes et jauges",
  description: "Toutes les cohortes (passées, en cours, à venir) avec leur jauge : capacité, payés, places gardées, pré-engagés, places restantes, statut, clôture des admissions.",
  level: "read",
  input: z.object({ upcomingOnly: z.boolean().default(true).describe("Seulement celles qui n'ont pas fini") }),
  run: async ({ upcomingOnly }, { now }) => {
    const cohorts = await listCohortsWithGauge();
    return cohorts
      .filter((c) => !upcomingOnly || c.endsAt >= now)
      .map((c) => ({
        cohortId: c.id, cohorte: `${programName(c.program)} — ${c.name}`, programme: c.program, statut: c.status,
        debut: c.startsAt, fin: c.endsAt, clotureAdmissions: admissionClosesAt(c.startsAt),
        capacite: c.capacity, payes: c.gauge.confirmed, gardees: c.gauge.held, preEngages: c.gauge.preEngaged, restantes: c.gauge.remaining, jauge: c.gauge.label,
      }));
  },
});

export const upcomingCalls = defineTool({
  name: "upcoming_calls",
  title: "Rendez-vous à venir",
  description: "Les appels découverte et séances de conseil prévus dans les prochains jours, avec le prospect, son fuseau horaire et le lien Meet.",
  level: "read",
  input: z.object({ days: z.number().int().min(1).max(60).default(7) }),
  run: async ({ days }, { now }) => {
    const rows = await prisma.booking.findMany({
      where: { status: "scheduled", startsAt: { gte: new Date(now.getTime() - 60 * 60_000), lt: new Date(now.getTime() + days * DAY_MS) } },
      orderBy: { startsAt: "asc" },
      select: { id: true, kind: true, startsAt: true, endsAt: true, timezone: true, meetUrl: true, lead: { select: { id: true, firstName: true, lastName: true, email: true, whatsapp: true, heatScore: true, readiness: true, goals: true } } },
    });
    return rows.map((b) => ({ bookingId: b.id, type: b.kind === "discovery" ? "appel découverte" : "séance de conseil", debut: b.startsAt, fin: b.endsAt, fuseauProspect: b.timezone, meet: b.meetUrl, prospect: { id: b.lead.id, nom: fullName(b.lead), email: b.lead.email, whatsapp: b.lead.whatsapp, chaleur: b.lead.heatScore, preparation: b.lead.readiness, objectifs: b.lead.goals } }));
  },
});

export const freeSlots = defineTool({
  name: "free_slots",
  title: "Créneaux libres",
  description: "Les créneaux libres pour un appel découverte, recalculés depuis l'agenda Google réel (comme la page /rdv).",
  level: "read",
  input: z.object({ limit: z.number().int().min(1).max(60).default(20) }),
  run: async ({ limit }, { now }) => {
    const listing = await listSlots(now);
    if (!listing.available) {
      const why = { not_connected: "Agenda Google non connecté (Admin › Paramètres › Google).", no_rules: "Aucune plage de disponibilité définie.", calendar_error: "L'agenda Google ne répond pas ; voir Admin › Santé des intégrations." }[listing.reason];
      throw new ToolError(why);
    }
    return { fuseauDuCoach: listing.coachTimeZone, total: listing.slots.length, creneaux: listing.slots.slice(0, limit) };
  },
});

export const paymentsOverview = defineTool({
  name: "payments_overview",
  title: "Paiements",
  description: "Les places payées sur la période, les paiements manuels en attente de confirmation, et les soldes encore dus (paiement en deux fois).",
  level: "read",
  input: z.object({ days: z.number().int().min(1).max(365).default(30) }),
  run: async ({ days }, { now }) => {
    const since = new Date(now.getTime() - days * DAY_MS);
    const select = { id: true, reference: true, status: true, method: true, amountUsd: true, discountUsd: true, promoCode: true, balanceUsd: true, paidAt: true, createdAt: true, lead: { select: { id: true, firstName: true, lastName: true } }, cohort: { select: { program: true, name: true, startsAt: true } } } as const;
    const [paid, pendingManual, balances] = await Promise.all([
      prisma.registration.findMany({ where: { status: "paid", paidAt: { gte: since } }, orderBy: { paidAt: "desc" }, select }),
      prisma.registration.findMany({ where: { status: "pending_manual" }, orderBy: { createdAt: "asc" }, select }),
      prisma.registration.findMany({ where: { status: "paid", balanceUsd: { gt: 0 }, balancePaidAt: null }, orderBy: { cohort: { startsAt: "asc" } }, select }),
    ]);
    const row = (r: (typeof paid)[number]) => ({ registrationId: r.id, reference: r.reference, prospect: { id: r.lead.id, nom: fullName(r.lead) }, cohorte: `${programName(r.cohort.program)} — ${r.cohort.name}`, moyen: r.method, montant: usd(r.amountUsd), remise: r.discountUsd ? usd(r.discountUsd) : null, codePromo: r.promoCode, payeLe: r.paidAt, creeLe: r.createdAt });
    return {
      periode: `${days} derniers jours`,
      encaisse: usd(paid.reduce((s, r) => s + r.amountUsd - r.balanceUsd, 0)),
      payes: paid.map(row),
      aConfirmer: pendingManual.map(row),
      soldesDus: balances.map((r) => ({ ...row(r), solde: usd(r.balanceUsd), debutCohorte: r.cohort.startsAt })),
    };
  },
});

export const funnelReport = defineTool({
  name: "funnel_report",
  title: "Tunnel de la semaine",
  description: "Le tunnel CISSP/CC des 7 derniers jours comparé aux 7 précédents : étapes (visites, analyses, résultats, appels, offres, paiements), abandons par question, sources, pays, clics sur les boutons, questions de FAQ ouvertes, tests ExamBoot, pages de conseil.",
  level: "read",
  input: z.object({}),
  run: async (_args, { now }) => {
    const r = await tunnelReport(now);
    return { du: r.since, au: r.until, etapes: r.funnel, abandons: r.dropoff, tauxDeFinAnalyse: r.completion, questionQuiFaitPerdre: r.worstDrop, sources: r.sources, pays: r.countries, boutons: r.ctas, faq: r.faq, retours: r.returns, examboot: r.examboot, conseil: r.services };
  },
});

export const marketingOverview = defineTool({
  name: "marketing_overview",
  title: "Marketing",
  description: "Les publications : programmées (et en erreur), publiées récemment, brouillons proposés à valider, et celles qui ont amené le plus de visites sur la période.",
  level: "read",
  input: z.object({ days: z.number().int().min(1).max(90).default(14) }),
  run: async ({ days }, { now }) => {
    const since = new Date(now.getTime() - days * DAY_MS);
    const select = { id: true, channel: true, topic: true, pillar: true, destination: true, text: true, scheduledFor: true, publishedAt: true, publishError: true, autoDraft: true, createdAt: true, cohort: { select: { program: true, name: true } } } as const;
    const [scheduled, published, drafts, best] = await Promise.all([
      prisma.marketingPost.findMany({ where: { scheduledFor: { not: null }, publishedAt: null }, orderBy: { scheduledFor: "asc" }, take: 20, select }),
      prisma.marketingPost.findMany({ where: { publishedAt: { gte: since } }, orderBy: { publishedAt: "desc" }, take: 20, select }),
      prisma.marketingPost.findMany({ where: { autoDraft: true, publishedAt: null, scheduledFor: null }, orderBy: { createdAt: "desc" }, take: 10, select }),
      topPosts(since, now, 5),
    ]);
    const post = (p: (typeof scheduled)[number]) => ({ postId: p.id, canal: p.channel, sujet: p.topic, pilier: p.pillar, destination: p.destination, cohorte: p.cohort ? `${programName(p.cohort.program)} — ${p.cohort.name}` : null, programmeLe: p.scheduledFor, publieLe: p.publishedAt, erreur: p.publishError, debut: p.text.slice(0, 280) });
    return { programmees: scheduled.map(post), publiees: published.map(post), brouillonsAValider: drafts.map(post), quiOntAmeneLePlus: best };
  },
});

export const adsAndPromos = defineTool({
  name: "ads_and_promos",
  title: "Pub payante et codes promo",
  description: "Les campagnes payantes suivies (dépense, visites, prospects, places payées, coût par prospect et par inscrit, verdict) et les codes promo (partenaires, parrainage) avec leurs utilisations payées.",
  level: "read",
  input: z.object({ activeOnly: z.boolean().default(true) }),
  run: async ({ activeOnly }) => {
    const [ads, codes, uses] = await Promise.all([
      loadAdCampaigns(activeOnly ? { active: true } : {}),
      prisma.promoCode.findMany({ where: activeOnly ? { active: true } : {}, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.registration.groupBy({ by: ["promoCode"], where: { status: "paid", promoCode: { not: null } }, _count: { _all: true } }),
    ]);
    const used = new Map(uses.map((u) => [u.promoCode, u._count._all]));
    return {
      campagnes: ads.map((a) => ({ campagne: a.name, code: a.code, canal: AD_CHANNELS[a.channel]?.label ?? a.channel, destination: a.destination, cohorte: a.cohortName, active: a.active, budget: a.budgetUsd ? usd(a.budgetUsd) : null, depense: usd(a.metrics.spentCents), depenseMiseAJour: a.spentUpdatedAt, visites: a.metrics.visits, prospects: a.metrics.leads, placesPayees: a.metrics.paid, coutParProspect: usd(a.metrics.costPerLeadCents), coutParInscrit: usd(a.metrics.costPerSignupCents), verdict: VERDICT_LABEL[a.metrics.verdict], explication: verdictText(a.metrics) })),
      codesPromo: codes.map((c) => ({ code: c.code, type: c.kind === "referral" ? "parrainage" : "partenaire", pour: c.label, remise: `${c.percent} %`, programme: c.program ?? "tous", valableJusquau: c.validUntil, maxUtilisations: c.maxUses, utilisationsPayees: used.get(c.code) ?? 0, actif: c.active })),
    };
  },
});

export const analystReportTool = defineTool({
  name: "analyst_report",
  title: "Rapport de l'analyste",
  description: "Le rapport de l'analyste business (le plus récent, ou celui d'une semaine donnée) : diagnostic, jusqu'à 3 orientations classées avec leurs chiffres et l'action proposée, ce que Ben a retenu ou écarté, et le bilan des orientations de la semaine d'avant.",
  level: "read",
  input: z.object({ week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Lundi de la semaine (AAAA-MM-JJ) ; vide = la plus récente") }),
  run: async ({ week }) => {
    const key = week ?? (await prisma.analystReport.findFirst({ orderBy: { weekKey: "desc" }, select: { weekKey: true } }))?.weekKey;
    const report = key ? await analystReport(key) : null;
    if (!report) throw new ToolError("Pas encore d'analyse. La première arrive dimanche ; Ben peut aussi la lancer depuis Admin › Analyste.");
    const decisions = readDecisions(report.decisions);
    return {
      semaine: report.weekKey, generee: report.updatedAt, diagnostic: report.output.diagnosis,
      orientations: report.output.bets.map((b, i) => ({ rang: i + 1, titre: b.title, confiance: CONFIDENCE[b.confidence], chiffres: b.facts, action: b.action, aSuivre: b.watch, decision: decisions[String(i + 1)]?.status ?? "à décider" })),
      bilanSemainePrecedente: report.output.review,
    };
  },
});

export const healthCheck = defineTool({
  name: "health_check",
  title: "Santé des intégrations",
  description: "Teste, en lecture seule, chaque service externe (base, connexion admin, agenda Google, e-mails, Stripe, Netticket, IA, LinkedIn, images, stockage, vidéo, ExamBoot, tâche quotidienne, domaine Bâtisseur IA) et dit quoi faire en cas de panne. Prend jusqu'à une dizaine de secondes.",
  level: "read",
  input: z.object({}),
  run: async () => {
    const results = await runAllChecks();
    return { resume: summary(results), services: results.map((r) => ({ service: r.name, role: r.role, etat: r.status, detail: r.detail, pourCorriger: r.fix, reglage: r.href })) };
  },
});

/** In the order Claude reads them. */
export const MCP_TOOLS: readonly ToolDef[] = [pilotOverview, actionQueue, searchLeads, getLead, listCohorts, upcomingCalls, freeSlots, paymentsOverview, funnelReport, marketingOverview, adsAndPromos, analystReportTool, healthCheck];
