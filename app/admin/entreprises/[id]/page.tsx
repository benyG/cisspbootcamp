import { Bot } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { iaFontVariables } from "@/app/(public)/ia/fonts";
import { ProposalEditor } from "@/components/admin/enterprise/ProposalEditor";
import { formatWhen } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { FUNCTIONS, type FunctionKey, SIZES, type SizeKey, STATUSES, type Status, draftProposal, formatUsd } from "@/lib/enterprise";
import { depositUrl, loadOffer, readProposal, zoneOf } from "@/lib/enterprise-server";
import { countryLabel } from "@/lib/quotes";

import { confirmDepositAction, deleteRequestAction, updateRequestAction } from "../actions";

export const dynamic = "force-dynamic";

const day = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

/**
 * One company's request (Ben, 22/11): who they are, the scoping call, then
 * the proposal to adjust, download as PDF and send with the deposit link.
 */
export default async function EnterpriseRequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const r = await prisma.enterpriseRequest.findUnique({
    where: { id: Number(id) || 0 },
    include: { lead: { select: { id: true, bookings: { where: { kind: "enterprise" }, orderBy: { startsAt: "desc" }, take: 3 } } } },
  });
  if (!r) notFound();
  const [offer, zone] = await Promise.all([loadOffer(), zoneOf(r.country)]);
  const functions = Array.isArray(r.functions) ? (r.functions as string[]) : [];
  const proposal = readProposal(r.proposal) ?? draftProposal({ contactName: r.contactName, jobTitle: r.jobTitle, need: r.need, functions, zone }, offer);
  const today = new Date().toISOString().slice(0, 10);
  const status = r.status as Status;

  return (
    <main className={`${iaFontVariables} mx-auto w-full max-w-7xl flex-1 px-5 py-8 print:p-0`}>
      <div className="print:hidden">
        <Link href="/admin/entreprises" className="text-sm text-muted">← Entreprises IA</Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Bot className="size-6 text-accent" aria-hidden />{r.organization}</h1>
          <span className="rounded-full bg-paper px-2.5 py-0.5 text-xs font-bold">{STATUSES[status] ?? r.status}</span>
        </div>
        {sp.ok && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{sp.ok}</p>}
        {sp.erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{sp.erreur}</p>}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="grid content-start gap-3 rounded-xl border border-line bg-white p-4 text-sm">
            <h2 className="text-xs font-bold tracking-[.06em] text-muted uppercase">La demande</h2>
            <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[max-content_1fr]">
              <dt className="text-muted">Contact</dt><dd><b>{r.contactName}</b>{r.jobTitle ? `, ${r.jobTitle}` : ""}{r.lead && <> · <Link href={`/admin/leads/${r.lead.id}`} className="underline">fiche</Link></>}</dd>
              <dt className="text-muted">E-mail</dt><dd><a href={`mailto:${r.email}`} className="underline">{r.email}</a></dd>
              <dt className="text-muted">Pays · taille</dt><dd>{countryLabel(r.country)} · {SIZES[r.size as SizeKey] ?? r.size}</dd>
              <dt className="text-muted">À traiter</dt><dd>{functions.map((f) => FUNCTIONS[f as FunctionKey] ?? f).join(", ") || "non précisé"}</dd>
              <dt className="text-muted">Reçue</dt><dd>{day(r.createdAt)} · consentement le {r.consentAt.toLocaleString("fr-FR")}</dd>
            </dl>
            {r.need && <p className="whitespace-pre-line rounded-lg bg-paper p-3">« {r.need} »</p>}
            <h2 className="mt-1 text-xs font-bold tracking-[.06em] text-muted uppercase">Appel de cadrage</h2>
            {r.lead?.bookings.length ? (
              <ul className="grid gap-1">{r.lead.bookings.map((b) => <li key={b.id}>{formatWhen(b.startsAt, "Africa/Abidjan")} (Abidjan) · {b.status === "scheduled" ? "prévu" : b.status}{b.meetUrl && b.status === "scheduled" && <> · <a href={b.meetUrl} className="underline">visio</a></>}</li>)}</ul>
            ) : <p className="text-muted">Pas encore réservé. Le lien de réservation a été montré juste après la demande.</p>}
          </section>

          <section className="grid content-start gap-3 rounded-xl border border-line bg-white p-4 text-sm">
            <h2 className="text-xs font-bold tracking-[.06em] text-muted uppercase">Suivi</h2>
            <form action={updateRequestAction} className="grid gap-2">
              <input type="hidden" name="id" value={r.id} />
              <label className="grid gap-1 font-medium">Note interne
                <textarea name="note" rows={3} maxLength={4000} defaultValue={r.note ?? ""} placeholder="Ex. : appel le 25/11, veut commencer par WhatsApp" className="rounded-lg border border-line px-3 py-2 text-base font-normal" /></label>
              <div className="flex flex-wrap items-center gap-2">
                <select name="status" defaultValue={r.status} className="rounded-lg border border-line bg-white px-3 py-2">{Object.entries(STATUSES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Enregistrer</button>
              </div>
            </form>
            <h2 className="mt-1 text-xs font-bold tracking-[.06em] text-muted uppercase">Acompte</h2>
            {r.depositPaidAt ? (
              <p className="rounded-lg bg-accent-soft px-3 py-2 text-accent-ink">Payé le {day(r.depositPaidAt)} : {formatUsd(r.depositUsd ?? 0)} ({r.depositMethod === "manual" ? `confirmé à la main : ${r.depositNote}` : "carte"}). Reçu émis.</p>
            ) : r.depositUsd ? (
              <>
                <p>{formatUsd(r.depositUsd)} demandé · lien : <span className="font-mono text-xs break-all">{depositUrl(r.token)}</span></p>
                <form action={confirmDepositAction} className="grid gap-2 border-t border-dashed border-line pt-2">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="grid gap-1 text-xs font-semibold">Virement reçu ? Preuve du paiement
                    <input name="note" maxLength={300} placeholder="Ex. : virement reçu le 24/11, réf. banque 81234" className="rounded-lg border border-line px-3 py-2 text-sm font-normal" /></label>
                  <button className="justify-self-start rounded-lg border border-line px-3 py-1.5 text-sm font-semibold">Confirmer l’acompte à la main</button>
                </form>
              </>
            ) : <p className="text-muted">Enregistrez la proposition, puis « Créer le lien d’acompte ».</p>}
            {!r.depositPaidAt && (
              <form action={deleteRequestAction} className="flex flex-wrap items-center gap-2 border-t border-dashed border-line pt-3">
                <input type="hidden" name="id" value={r.id} />
                <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" name="confirm" />Supprimer définitivement cette demande</label>
                <button className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800">Supprimer</button>
              </form>
            )}
          </section>
        </div>

        <h2 className="mt-8 text-xl font-bold">La proposition</h2>
        <p className="mt-1 text-sm text-muted">Ajustez à gauche avec ce que vous avez entendu à l&apos;appel ; le document à droite est celui que le client reçoit. Écrivez pour une direction non technique : leurs mots, trois résultats, un prix.</p>
      </div>
      <div className="mt-4 print:mt-0">
        <ProposalEditor requestId={r.id} initial={proposal} offer={offer} head={{ number: r.quoteNumber, organization: r.organization }} today={today} depositLink={r.depositUsd ? depositUrl(r.token) : null} />
      </div>
    </main>
  );
}
