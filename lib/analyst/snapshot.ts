import { loadAdCampaigns } from "@/lib/ads-server";
import { AD_CHANNELS, usdCents } from "@/lib/ads";
import { prisma } from "@/lib/db";
import { forecastSentence, stateLabel } from "@/lib/pilotage";
import { cohortTitle, loadPilotCohorts, programFunnels, topPosts } from "@/lib/pilotage-server";
import { PROGRAMS } from "@/lib/programs";
import { tunnelReport } from "@/lib/tracking/report";

import { type AnalystOutput, KEEP_DAYS, delta, rate, readDecisions } from "./rules";

/**
 * The photo of the week the analyst reads (Ben, 08/11). No AI here and no
 * person: counts, rates and labels only, from the pilotage, the tunnel, the
 * marketing links, the paid campaigns, the promo codes and the playbooks.
 * The last seven days against the seven before.
 */

const DAY_MS = 86_400_000;

export type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;

export async function buildSnapshot(now = new Date()) {
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const before = new Date(since.getTime() - 7 * DAY_MS);
  const [cohorts, tunnel, iaWeek, iaBefore, posts, ads, promoUses, logs, leadsWeek, leadsBefore, previous] = await Promise.all([
    loadPilotCohorts(now),
    tunnelReport(now),
    programFunnels(since, now),
    programFunnels(before, since),
    topPosts(since, now, 5),
    loadAdCampaigns({ active: true }),
    prisma.registration.groupBy({ by: ["promoCode"], where: { status: "paid", paidAt: { gte: since }, promoCode: { not: null } }, _count: { _all: true } }),
    prisma.actionLog.groupBy({ by: ["type"], where: { createdAt: { gte: since }, type: { in: ["playbook_unfinished", "playbook_opening", "playbook_hot", "playbook_last_call", "catchup_email", "result_reminder", "after_call_email", "playbook_late", "playbook_content"] } }, _count: { _all: true } }),
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.lead.count({ where: { createdAt: { gte: before, lt: since } } }),
    prisma.analystReport.findFirst({ where: { createdAt: { lt: new Date(now.getTime() - DAY_MS), gte: new Date(now.getTime() - KEEP_DAYS * DAY_MS) } }, orderBy: { createdAt: "desc" }, select: { output: true, decisions: true, snapshot: true } }),
  ]);

  const step = (name: string) => tunnel.funnel.find((f) => f.name === name);
  const count = (name: string) => step(name)?.count ?? 0;
  const prev = (name: string) => step(name)?.previous ?? 0;
  const ia = (list: typeof iaWeek, i: number) => list.ia[i]?.count ?? 0;

  const keptLastWeek = (() => {
    if (!previous) return [];
    const out = previous.output as AnalystOutput;
    const decisions = readDecisions(previous.decisions);
    return (out.bets ?? []).flatMap((b, i) => (decisions[String(i + 1)]?.status === "kept" ? [{ orientation: b.title, aSuivre: `${b.watch.metric} (objectif : ${b.watch.target})` }] : []));
  })();

  return {
    periode: { du: since.toISOString().slice(0, 10), au: now.toISOString().slice(0, 10), comparaison: "les 7 jours précédents" },
    cohortes: cohorts.map((c) => ({
      cohorte: cohortTitle(c),
      programme: PROGRAMS[c.program].name,
      jour: `J${c.pilot.day}`,
      objectif: c.pilot.goal,
      placesPayees: c.pilot.paid,
      attenduesACeJour: c.pilot.state === "not_open" ? null : c.pilot.expected,
      etat: stateLabel(c.pilot),
      prevision: forecastSentence(c.pilot),
      inscriptionsCommenceesNonPayees: c.pendingRecent,
      placesTenues: c.held,
      origineDesPayes: c.sources.map((s) => `${s.source} : ${s.count}`),
    })),
    certificationsTunnel: {
      visites: { semaine: count("landing_view"), avant: prev("landing_view"), evolution: delta(count("landing_view"), prev("landing_view")) },
      analysesCommencees: { semaine: count("scanner_start"), avant: prev("scanner_start") },
      analysesTerminees: { semaine: count("scanner_submit"), avant: prev("scanner_submit") },
      resultatsVus: { semaine: count("result_view"), avant: prev("result_view") },
      appelsReserves: { semaine: count("booking_done"), avant: prev("booking_done") },
      offresVues: { semaine: count("offer_view"), avant: prev("offer_view") },
      paiements: { semaine: count("paid"), avant: prev("paid") },
      tauxAnalyseTermineeSurCommencee: rate(count("scanner_submit"), count("scanner_start")),
      tauxAppelSurResultatVu: rate(count("booking_done"), count("result_view")),
      tauxAppelSurResultatVuAvant: rate(prev("booking_done"), prev("result_view")),
      questionQuiFaitPerdre: tunnel.worstDrop ? `question ${tunnel.worstDrop.step}, ${tunnel.worstDrop.lostPercent} points perdus` : null,
      clicsBoutons: tunnel.ctas.slice(0, 6).map((c) => `${c.label} : ${c.clicks}`),
      questionsFaqOuvertes: tunnel.faq.slice(0, 5).map((f) => `${f.question} : ${f.opens}`),
      pays: tunnel.countries.slice(0, 6).map((c) => `${c.country} : ${c.submitted} analyses, ${c.paid} payés`),
    },
    batisseurIaTunnel: {
      visites: { semaine: ia(iaWeek, 0), avant: ia(iaBefore, 0), evolution: delta(ia(iaWeek, 0), ia(iaBefore, 0)) },
      diagnostics: { semaine: ia(iaWeek, 1), avant: ia(iaBefore, 1) },
      tauxDiagnosticSurVisite: rate(ia(iaWeek, 1), ia(iaWeek, 0)),
    },
    prospects: { nouveauxCetteSemaine: leadsWeek, semainePrecedente: leadsBefore, evolution: delta(leadsWeek, leadsBefore) },
    sources: tunnel.sources.slice(0, 8).map((s) => `${s.source} : ${s.visits} visites, ${s.submitted} analyses, ${s.paid} payés`),
    publications: posts.map((p) => `« ${p.topic} » (${p.channel}) : ${p.visitors} visites`),
    pubPayante: ads.map((a) => ({
      campagne: a.name,
      canal: AD_CHANNELS[a.channel]?.label ?? a.channel,
      depense: usdCents(a.metrics.spentCents),
      visites: a.metrics.visits,
      prospects: a.metrics.leads,
      placesPayees: a.metrics.paid,
      coutParProspect: a.metrics.costPerLeadCents === null ? null : usdCents(a.metrics.costPerLeadCents),
      coutParInscrit: a.metrics.costPerSignupCents === null ? null : usdCents(a.metrics.costPerSignupCents),
    })),
    codesPromoPayesCetteSemaine: promoUses.map((p) => `${p.promoCode} : ${p._count._all}`),
    envoisAutomatiquesCetteSemaine: logs.map((l) => `${l.type} : ${l._count._all}`),
    orientationsRetenuesLaSemaineDerniere: keptLastWeek,
  };
}
