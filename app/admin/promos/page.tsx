import { TicketPercent } from "lucide-react";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { iaUrl } from "@/lib/ia-domain";
import { waMeLink } from "@/lib/messaging/templates";
import { formatUsdCents } from "@/lib/pricing";
import { PROGRAMS, type ProgramCode } from "@/lib/programs";
import { PROMO_KINDS } from "@/lib/promo";

import { createPartnerCode, createReferralCodes, togglePromoCode } from "./actions";

export const dynamic = "force-dynamic";

const input = "rounded-lg border border-line bg-white px-3 py-2 text-sm";
const day = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Codes promo (lot 6): partner codes and alumni referral codes, each with
 * its paid uses, the money it brought and who recommended whom. A percentage
 * off the country's price, by card in one payment; the launch price of a
 * cohort is set in its campaign.
 */
export default async function PromosPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const { ok, erreur } = await searchParams;
  const [codes, uses] = await Promise.all([
    prisma.promoCode.findMany({ orderBy: [{ active: "desc" }, { createdAt: "desc" }] }),
    prisma.registration.findMany({ where: { status: "paid", promoCode: { not: null } }, select: { promoCode: true, amountUsd: true, discountUsd: true, lead: { select: { id: true, firstName: true, lastName: true } }, cohort: { select: { name: true } } }, orderBy: { paidAt: "desc" } }),
  ]);
  const referrers = await prisma.lead.findMany({ where: { id: { in: codes.map((c) => c.referrerLeadId).filter((x): x is number => x !== null) } }, select: { id: true, whatsapp: true } });
  const usesOf = (code: string) => uses.filter((u) => u.promoCode === code);
  const launchUses = usesOf("LANCEMENT");
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><TicketPercent className="size-6 shrink-0 text-accent" aria-hidden />Codes promo</h1>
      <p className="mt-1 text-sm text-muted">Un pourcentage sur le prix du pays, par carte et en une fois (le mobile money reste au prix plein). Jamais deux remises ensemble : la meilleure s’applique. Le tarif de lancement d’une cohorte se règle dans sa campagne.</p>
      {ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{ok}</p>}
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

      <section className="mt-6 rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">Codes</h2>
        {codes.length ? (
          <ul className="mt-2 divide-y divide-line">
            {codes.map((c) => {
              const used = usesOf(c.code);
              const referrer = referrers.find((r) => r.id === c.referrerLeadId);
              const link = c.program === "cc" ? `${base}/demarrer/inscription?code=${c.code}` : c.program === "ia" ? iaUrl(`/ia/inscription?code=${c.code}`, base) : `${base}/`;
              const share = `Bonjour ${c.label.split(" ")[0]}, merci encore d’avoir suivi la formation. Si quelqu’un autour de vous veut la suivre, votre code ${c.code} lui donne -${c.percent} % en payant par carte, à saisir au moment du paiement : ${link}`;
              return (
                <li key={c.id} className={"grid gap-1 py-3 text-sm " + (c.active ? "" : "opacity-55")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span><b className="font-mono">{c.code}</b> · -{c.percent} % · {PROMO_KINDS[c.kind as keyof typeof PROMO_KINDS] ?? c.kind} : {c.label}</span>
                    <span className="flex gap-1.5">
                      {c.kind === "referral" && referrer?.whatsapp && c.active && <a href={waMeLink(referrer.whatsapp, share)} target="_blank" rel="noopener" className="rounded-lg border border-line px-2.5 py-1 font-semibold">WhatsApp</a>}
                      <form action={togglePromoCode}><input type="hidden" name="id" value={c.id} /><button className="rounded-lg border border-line px-2.5 py-1 font-semibold">{c.active ? "Désactiver" : "Réactiver"}</button></form>
                    </span>
                  </div>
                  <span className="text-xs text-muted">{c.program ? PROGRAMS[c.program as ProgramCode]?.name : "Tous les programmes"}{c.validUntil ? ` · jusqu’au ${day.format(c.validUntil)}` : ""}{c.maxUses ? ` · ${c.maxUses} utilisations au plus` : ""} · {used.length} inscription{used.length > 1 ? "s" : ""} payée{used.length > 1 ? "s" : ""}{used.length ? ` (${formatUsdCents(used.reduce((n, u) => n + u.amountUsd, 0))} encaissés)` : ""}</span>
                  {used.length > 0 && <span className="text-xs text-ink-2">{c.kind === "referral" ? "A fait inscrire : " : "Inscrits : "}{used.map((u, i) => <span key={i}>{i ? ", " : ""}<Link href={`/admin/leads/${u.lead.id}`} className="underline">{u.lead.firstName} {u.lead.lastName}</Link> ({u.cohort.name})</span>)}</span>}
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-2 text-sm text-muted">Aucun code pour l’instant.</p>}
        {launchUses.length > 0 && <p className="mt-3 text-xs text-muted">Tarif de lancement : {launchUses.length} inscription{launchUses.length > 1 ? "s" : ""} payée{launchUses.length > 1 ? "s" : ""}, {formatUsdCents(launchUses.reduce((n, u) => n + u.discountUsd, 0))} de remise accordée.</p>}
      </section>

      <section className="mt-4 rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">Nouveau code partenaire</h2>
        <form action={createPartnerCode} className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <label className="grid gap-1"><span className="font-medium">Code</span><input name="code" required placeholder="ABIDJAN-TECH" className={input + " uppercase"} /></label>
          <label className="grid gap-1"><span className="font-medium">Partenaire</span><input name="label" required placeholder="Abidjan Tech Hub" className={input} /></label>
          <label className="grid gap-1"><span className="font-medium">Remise (%)</span><input name="percent" type="number" min={1} max={50} defaultValue={10} className={input} /></label>
          <label className="grid gap-1"><span className="font-medium">Programme</span><select name="program" defaultValue="" className={input}><option value="">Tous</option>{Object.values(PROGRAMS).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
          <label className="grid gap-1"><span className="font-medium">Jusqu’au (facultatif)</span><input name="validUntil" type="date" className={input} /></label>
          <label className="grid gap-1"><span className="font-medium">Utilisations au plus (facultatif)</span><input name="maxUses" type="number" min={1} className={input} /></label>
          <div className="col-span-2 flex justify-end"><button className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 font-semibold text-white">Créer le code</button></div>
        </form>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-white p-4">
        <h2 className="font-semibold">Codes de parrainage des anciens</h2>
        <p className="mt-1 text-sm text-muted">Un code par ancien participant du programme (cohortes commencées, non désinscrits). La remise va à la personne recommandée ; vous voyez ici qui a fait inscrire qui, et remerciez l’ancien vous-même.</p>
        <form action={createReferralCodes} className="mt-3 flex flex-wrap items-end gap-3 text-sm">
          <label className="grid gap-1"><span className="font-medium">Programme</span><select name="program" className={input}>{Object.values(PROGRAMS).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
          <label className="grid gap-1"><span className="font-medium">Remise (%)</span><input name="percent" type="number" min={1} max={50} defaultValue={10} className={input + " w-24"} /></label>
          <button className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 font-semibold text-white">Créer les codes</button>
        </form>
      </section>
    </main>
  );
}
