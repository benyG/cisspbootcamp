import { BadgeDollarSign } from "lucide-react";
import Link from "next/link";

import { CopyLink } from "@/components/admin/CopyLink";
import { AD_CHANNELS, AD_DESTINATIONS, type AdVerdict, VERDICT_LABEL, adLink, adMetrics, adTotals, usdCents, verdictText } from "@/lib/ads";
import { loadAdCampaigns } from "@/lib/ads-server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { PROGRAMS, type ProgramCode } from "@/lib/programs";

import { createAdCampaign, toggleAdCampaign, updateAdSpend } from "./actions";

export const dynamic = "force-dynamic";

const input = "rounded-lg border border-line bg-white px-3 py-2 text-sm";
const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

const VERDICT_STYLE: Record<AdVerdict, string> = {
  too_early: "bg-slate-100 text-muted",
  no_signup: "bg-amber-50 text-amber-800",
  good: "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]",
  watch: "bg-amber-50 text-amber-800",
  high: "bg-red-50 text-red-800",
};

/**
 * Pub payante (lot 8): each paid campaign Ben runs in Meta, LinkedIn or
 * Google, its tracked link, what he has spent, and what it brought:
 * visits, prospects, paid seats, cost per prospect and per signup.
 */
export default async function AdsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string; c?: string }> }) {
  const { ok, erreur, c } = await searchParams;
  const now = new Date();
  const [rows, cohorts] = await Promise.all([
    loadAdCampaigns(),
    prisma.cohort.findMany({ where: { startsAt: { gte: now }, status: { in: ["planned", "open", "full"] } }, orderBy: { startsAt: "asc" }, take: 12, select: { id: true, name: true, program: true } }),
  ]);
  const totals = adMetrics(adTotals(rows.map((r) => r.metrics)));
  const base = env.NEXT_PUBLIC_APP_URL;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><BadgeDollarSign className="size-6 shrink-0 text-accent" aria-hidden />Pub payante</h1>
      <p className="mt-1 text-sm text-muted">Vous lancez la publicité dans Meta, LinkedIn ou Google. Ici : son lien suivi, ce que vous avez dépensé, et ce qu’elle rapporte. Un prospect compte pour la campagne par laquelle il est arrivé la première fois.</p>
      {ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{ok}</p>}
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

      {rows.length > 0 && (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile value={usdCents(totals.spentCents)} label="dépensés" />
          <Tile value={String(totals.leads)} label={`prospect${totals.leads > 1 ? "s" : ""}`} sub={totals.costPerLeadCents ? `${usdCents(totals.costPerLeadCents)} l’un` : undefined} />
          <Tile value={String(totals.paid)} label={`place${totals.paid > 1 ? "s" : ""} payée${totals.paid > 1 ? "s" : ""}`} />
          <Tile value={totals.costPerSignupCents ? usdCents(totals.costPerSignupCents) : "—"} label="coût par inscrit" />
        </div>
      )}

      <section className="mt-5 rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">Campagnes</h2>
        {rows.length ? (
          <ul className="mt-2 divide-y divide-line">
            {rows.map((r) => {
              const m = r.metrics;
              return (
                <li key={r.id} className={"grid gap-2 py-3 text-sm " + (r.active ? "" : "opacity-60")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span><b>{r.name}</b> · {AD_CHANNELS[r.channel]?.label ?? r.channel}{r.cohortName ? ` · ${r.cohortName}` : ""}{r.active ? "" : " · terminée"}</span>
                    <span className={"rounded-full px-2.5 py-0.5 text-xs font-semibold " + VERDICT_STYLE[m.verdict]}>{VERDICT_LABEL[m.verdict]}</span>
                  </div>
                  <p className="text-ink-2">{verdictText(m)}</p>
                  <p className="tabular-nums text-xs text-muted">
                    {m.visits} visite{m.visits > 1 ? "s" : ""}{m.costPerVisitCents ? ` (${usdCents(m.costPerVisitCents)} l’une)` : ""} · {m.leads} prospect{m.leads > 1 ? "s" : ""}{m.costPerLeadCents ? ` (${usdCents(m.costPerLeadCents)} l’un)` : ""} · {m.paid} place{m.paid > 1 ? "s" : ""} payée{m.paid > 1 ? "s" : ""}{m.revenueCents ? `, ${usdCents(m.revenueCents)} encaissés` : ""}{m.returnRatio ? ` · ${m.returnRatio.toLocaleString("fr-FR")} USD rapportés par dollar` : ""}{r.budgetUsd ? ` · budget ${usdCents(r.budgetUsd * 100)}` : ""}
                  </p>
                  {r.active && <CopyLink value={adLink(base, r)} />}
                  <div className="flex flex-wrap items-end gap-2">
                    <form action={updateAdSpend} className="flex items-end gap-2">
                      <input type="hidden" name="id" value={r.id} />
                      <label className="grid gap-1 text-xs"><span className="font-medium">Dépensé à ce jour (USD){r.spentUpdatedAt ? `, saisi le ${day.format(r.spentUpdatedAt)}` : ""}</span><input name="spent" inputMode="decimal" defaultValue={m.spentCents ? String(m.spentCents / 100).replace(".", ",") : ""} placeholder="0" className={input + " w-32"} /></label>
                      <button className="rounded-lg border border-line px-3 py-2 text-sm font-semibold">Enregistrer</button>
                    </form>
                    <form action={toggleAdCampaign}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-lg px-2 py-2 text-xs text-muted underline">{r.active ? "Marquer terminée" : "Réactiver"}</button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-2 text-sm text-muted">Aucune campagne pour l’instant. Créez-la ici avant de la lancer, pour mettre son lien suivi dans la publicité.</p>}
      </section>

      <section className="mt-4 rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">Nouvelle campagne</h2>
        <form action={createAdCampaign} className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2 grid gap-1"><span className="font-medium">Nom</span><input name="name" required maxLength={80} placeholder="Relance décembre, Facebook Côte d’Ivoire" className={input} /></label>
          <label className="grid gap-1"><span className="font-medium">Où</span><select name="channel" className={input}>{Object.entries(AD_CHANNELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <label className="grid gap-1"><span className="font-medium">Vers</span><select name="destination" className={input}>{Object.entries(AD_DESTINATIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <label className="grid gap-1"><span className="font-medium">Cohorte (facultatif)</span><select name="cohortId" defaultValue={c ?? ""} className={input}><option value="">Aucune</option>{cohorts.map((x) => <option key={x.id} value={x.id}>{PROGRAMS[x.program as ProgramCode]?.name} — {x.name}</option>)}</select></label>
          <label className="grid gap-1"><span className="font-medium">Budget prévu (USD, facultatif)</span><input name="budgetUsd" type="number" min={1} className={input} /></label>
          <div className="col-span-2 flex justify-end"><button className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 font-semibold text-white">Créer et obtenir le lien</button></div>
        </form>
      </section>
    </main>
  );
}

function Tile({ value, sub, label }: { value: string; sub?: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2.5">
      <div className="display text-xl font-black tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}{sub ? ` · ${sub}` : ""}</div>
    </div>
  );
}
