"use client";

import { useMemo, useState } from "react";

import { CampaignPlan } from "@/components/admin/campaign/CampaignPlan";
import { type Campaign, DEFAULT_CAMPAIGN, buildCampaignPlan, campaignFromForm, planCounts } from "@/lib/campaign";

const input = "w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm";

type CohortFields = { program: string; name: string; startsAt: string; endsAt: string; capacity: number; targetSeats: string; status: string };

/**
 * "Lancer une cohorte" (lot 5, validated on the prototype): the cohort, its
 * goal, the promo and the channels, with the dated plan updated as Ben
 * types. In "edit" mode, only the campaign of an existing cohort. The form
 * posts plain fields to the server action, which parses them again.
 */
export function CampaignWizard({
  mode,
  action,
  cohortId,
  programs,
  statuses,
  initial,
  campaign = DEFAULT_CAMPAIGN,
}: {
  mode: "create" | "edit";
  action: (formData: FormData) => void | Promise<void>;
  cohortId?: number;
  programs: Array<{ code: string; name: string; days: number }>;
  statuses?: Array<{ value: string; label: string }>;
  initial: CohortFields;
  campaign?: Campaign;
}) {
  const [c, setC] = useState(initial);
  const [values, setValues] = useState<Record<string, string>>(() => ({
    chEmail: campaign.channels.email ? "on" : "",
    chLinkedin: campaign.channels.linkedin ? "on" : "",
    chFacebook: campaign.channels.facebook ? "on" : "",
    chWhatsapp: campaign.channels.whatsapp ? "on" : "",
    chAds: campaign.channels.ads ? "on" : "",
    adsBudgetUsd: campaign.adsBudgetUsd ? String(campaign.adsBudgetUsd) : "",
    promoEarly: campaign.promo.early ? "on" : "",
    earlyPercent: campaign.promo.early ? String(campaign.promo.early.percent) : "",
    earlyUntil: campaign.promo.early?.until ?? "",
    promoPartners: campaign.promo.partners ? "on" : "",
    promoReferral: campaign.promo.referral ? "on" : "",
  }));
  const set = (name: string, value: string) => setValues((v) => ({ ...v, [name]: value }));
  const check = (name: string) => (e: React.ChangeEvent<HTMLInputElement>) => set(name, e.target.checked ? "on" : "");

  const program = programs.find((p) => p.code === c.program) ?? programs[0]!;
  const plan = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.startsAt)) return null;
    const startsAt = new Date(`${c.startsAt}T00:00:00Z`);
    // CISSP: the last day is computed on save; the preview assumes the programme's length.
    const endsAt = /^\d{4}-\d{2}-\d{2}$/.test(c.endsAt) ? new Date(`${c.endsAt}T00:00:00Z`) : new Date(startsAt.getTime() + Math.max(1, program.days - 1) * 86_400_000);
    const goal = Number(c.targetSeats) || Number(c.capacity) || 10;
    return buildCampaignPlan({ program: c.program, startsAt, endsAt, goal }, campaignFromForm((name) => values[name] ?? null));
  }, [c, values, program.days]);
  const counts = plan ? planCounts(plan) : null;

  return (
    <div className={"grid gap-5 " + (mode === "create" ? "lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start" : "")}>
      <form action={action} className="grid gap-4 rounded-xl border border-line bg-white p-4">
        <input type="hidden" name="hasCampaign" value="1" />
        {cohortId && <input type="hidden" name="id" value={cohortId} />}
        {mode === "create" && (
          <>
            <label className="grid gap-1 text-sm"><span className="font-medium">Programme</span>
              <select name="program" value={c.program} onChange={(e) => setC({ ...c, program: e.target.value })} className={input}>
                {programs.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm"><span className="font-medium">Nom</span>
              <input name="name" required value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} placeholder="Cohorte de février 2027" className={input} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm"><span className="font-medium">Premier jour</span>
                <input name="startsAt" type="date" required value={c.startsAt} onChange={(e) => setC({ ...c, startsAt: e.target.value })} className={input} />
              </label>
              <label className="grid gap-1 text-sm"><span className="font-medium">Dernier jour</span>
                <input name="endsAt" type="date" value={c.endsAt} onChange={(e) => setC({ ...c, endsAt: e.target.value })} className={input} />
              </label>
            </div>
            {c.program === "cissp" && <p className="-mt-2 text-xs text-muted">CISSP : le dernier jour est calculé à l’enregistrement.</p>}
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm"><span className="font-medium">Capacité</span>
                <input name="capacity" type="number" min={1} max={100} value={c.capacity} onChange={(e) => setC({ ...c, capacity: Number(e.target.value) })} className={input} />
              </label>
              <label className="grid gap-1 text-sm"><span className="font-medium">Objectif de places</span>
                <input name="targetSeats" type="number" min={1} max={100} value={c.targetSeats} placeholder="= capacité" onChange={(e) => setC({ ...c, targetSeats: e.target.value })} className={input} />
              </label>
            </div>
            <label className="grid gap-1 text-sm"><span className="font-medium">Inscriptions</span>
              <select name="status" value={c.status} onChange={(e) => setC({ ...c, status: e.target.value })} className={input}>
                {statuses?.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </label>
          </>
        )}

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Promo</legend>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="promoEarly" checked={values.promoEarly === "on"} onChange={check("promoEarly")} className="mt-1 accent-[var(--color-accent)]" /><span>Tarif de lancement<span className="block text-xs text-muted">Un prix réduit jusqu’à une vraie date limite</span></span></label>
          {values.promoEarly === "on" && (
            <div className="grid grid-cols-2 gap-2 pl-6">
              <label className="grid gap-1 text-xs text-muted">Remise (%)<input name="earlyPercent" type="number" min={1} max={50} value={values.earlyPercent} onChange={(e) => set("earlyPercent", e.target.value)} className={input} /></label>
              <label className="grid gap-1 text-xs text-muted">Jusqu’au<input name="earlyUntil" type="date" value={values.earlyUntil} onChange={(e) => set("earlyUntil", e.target.value)} className={input} /></label>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="promoPartners" checked={values.promoPartners === "on"} onChange={check("promoPartners")} className="mt-1 accent-[var(--color-accent)]" /><span>Codes partenaires</span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="promoReferral" checked={values.promoReferral === "on"} onChange={check("promoReferral")} className="mt-1 accent-[var(--color-accent)]" /><span>Parrainage des anciens</span></label>
          <p className="text-xs text-muted">Les promos s’appliquent au paiement par carte, en une fois, sur le prix du pays. Le mobile money reste au prix plein.</p>
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Canaux</legend>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="chEmail" checked={values.chEmail === "on"} onChange={check("chEmail")} className="mt-1 accent-[var(--color-accent)]" /><span>E-mail<span className="block text-xs text-muted">Uniquement les personnes qui ont donné leur accord</span></span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="chLinkedin" checked={values.chLinkedin === "on"} onChange={check("chLinkedin")} className="mt-1 accent-[var(--color-accent)]" /><span>LinkedIn</span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="chFacebook" checked={values.chFacebook === "on"} onChange={check("chFacebook")} className="mt-1 accent-[var(--color-accent)]" /><span>Facebook<span className="block text-xs text-muted">Publication depuis l’admin quand Meta aura validé l’application</span></span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="chWhatsapp" checked={values.chWhatsapp === "on"} onChange={check("chWhatsapp")} className="mt-1 accent-[var(--color-accent)]" /><span>WhatsApp<span className="block text-xs text-muted">Messages prêts, envoyés par vous en un clic</span></span></label>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="chAds" checked={values.chAds === "on"} onChange={check("chAds")} className="mt-1 accent-[var(--color-accent)]" /><span>Pub payante<span className="block text-xs text-muted">Textes, visuels et liens suivis prêts ; vous lancez la campagne</span></span></label>
          {values.chAds === "on" && <label className="grid gap-1 pl-6 text-xs text-muted">Budget (USD)<input name="adsBudgetUsd" type="number" min={0} value={values.adsBudgetUsd} onChange={(e) => set("adsBudgetUsd", e.target.value)} className={input} /></label>}
        </fieldset>

        <button type="submit" className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 font-semibold text-white">{mode === "create" ? "Lancer la cohorte" : "Enregistrer la campagne"}</button>
        <p className="text-xs text-muted">Les actions « à valider » arrivent dans votre file d’actions à leur date. Les autres partent seules, dans les limites des garde-fous des playbooks.</p>
      </form>

      <section className="min-w-0 rounded-xl border border-line bg-white p-4">
        <h2 className="font-bold">Plan de campagne</h2>
        {plan && counts ? (
          <>
            <p className="mt-1 text-sm text-muted">{counts.auto} actions automatiques · {counts.validate} à valider · de J-60 à une semaine après le dernier jour</p>
            <div className="mt-3"><CampaignPlan plan={plan} hideLinks /></div>
          </>
        ) : <p className="mt-2 text-sm text-muted">Choisissez le premier jour pour voir le plan.</p>}
      </section>
    </div>
  );
}
