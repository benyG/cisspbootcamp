import { Landmark } from "lucide-react";
import Link from "next/link";

import { METHOD_LABEL, PRIVACY_KINDS, PRIVACY_LABEL, type PrivacyKind, RECURRENCES, RECURRENCE_LABEL, type Recurrence, RETENTION_YEARS, businessComplete, daysLeft, monthBounds } from "@/lib/admin-records";
import { loadBusiness, retentionCandidates } from "@/lib/admin-records-server";
import { prisma } from "@/lib/db";
import { formatUsdCents } from "@/lib/pricing";

import { addDeadline, addPrivacyRequest, completeDeadlineAction, completePrivacyRequest, deleteDeadline, purgeRetention, saveBusinessAction } from "./actions";

export const dynamic = "force-dynamic";

const DAY = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const input = "rounded-lg border border-line px-3 py-2 text-sm";
const primary = "rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-white";
const ghost = "rounded-lg border border-line px-3 py-1.5 text-sm font-semibold";

function lastMonths(now: Date, n: number): string[] {
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
}

function left(due: Date, now: Date): { text: string; late: boolean } {
  const d = daysLeft(due, now);
  if (d < 0) return { text: `en retard de ${-d} j`, late: true };
  if (d === 0) return { text: "aujourd’hui", late: true };
  return { text: `dans ${d} j`, late: d <= 3 };
}

/**
 * Administratif (lot B): what the administrative agent of J6 does, for our
 * own business. Numbered receipts and the accountant's export, deadlines,
 * data requests, retention, the business identity, the register.
 */
export default async function AdministratifPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const now = new Date();
  const { mois } = await searchParams;
  const month = mois && monthBounds(mois) ? mois : now.toISOString().slice(0, 7);
  const bounds = monthBounds(month)!;
  const [business, receipts, deadlines, requests, candidates] = await Promise.all([
    loadBusiness(),
    prisma.receipt.findMany({ where: { paidAt: { gte: bounds.from, lt: bounds.to } }, orderBy: { number: "asc" } }),
    prisma.adminDeadline.findMany({ where: { doneAt: null }, orderBy: { dueAt: "asc" } }),
    prisma.privacyRequest.findMany({ where: { doneAt: null }, orderBy: { dueAt: "asc" } }),
    retentionCandidates(now),
  ]);
  const total = receipts.reduce((n, r) => n + r.amountUsd, 0);
  const today = now.toISOString().slice(0, 10);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Landmark className="size-6 shrink-0 text-accent" aria-hidden />Administratif</h1>
      <p className="mt-1 text-sm text-muted">Reçus numérotés, export comptable, échéances, demandes sur les données. Les mentions et les durées sont à valider avec votre comptable.</p>

      {!businessComplete(business) && (
        <p role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950">
          <b>Identité de l’entreprise incomplète.</b> Les reçus n’affichent ni raison sociale ni adresse. <a href="#identite" className="font-semibold underline">La compléter</a>
        </p>
      )}

      <section id="recus" className="mt-6 rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold">Reçus · {MONTH.format(bounds.from)}</h2>
          <a href={`/admin/administratif/export?mois=${month}`} className={primary}>CSV pour le comptable</a>
        </div>
        <p className="mt-1 text-sm">{receipts.length} reçu{receipts.length > 1 ? "s" : ""} · <b>{formatUsdCents(total)}</b> encaissés</p>
        <nav className="mt-2 flex flex-wrap gap-1.5 text-xs">
          {lastMonths(now, 6).map((m) => (
            <Link key={m} href={`/admin/administratif?mois=${m}#recus`} className={"rounded-full px-2.5 py-1 " + (m === month ? "bg-ink text-white" : "bg-slate-100 text-muted")}>{m.split("-").reverse().join("/")}</Link>
          ))}
        </nav>
        {receipts.length > 0 && (
          <ul className="mt-3 divide-y divide-line text-sm">
            {receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0">
                  <a href={`/admin/administratif/recu/${r.number}`} className="font-semibold underline">{r.number}</a> · {r.buyerName}
                  <span className="block truncate text-xs text-muted">{DAY.format(r.paidAt)} · {r.label} · {METHOD_LABEL[r.method]}</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatUsdCents(r.amountUsd)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">Chaque paiement reçoit un numéro continu (REC-000001, REC-000002…), jamais réutilisé. Les reçus restent même si la personne demande la suppression de ses données.</p>
      </section>

      <section id="echeances" className="mt-4 rounded-xl border border-line bg-white p-4">
        <h2 className="font-bold">Échéances</h2>
        {deadlines.length ? (
          <ul className="mt-2 divide-y divide-line">
            {deadlines.map((d) => {
              const l = left(d.dueAt, now);
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0 text-sm">
                    <b>{d.title}</b>
                    <span className={"block text-xs " + (l.late ? "font-semibold text-red-800" : "text-muted")}>{DAY.format(d.dueAt)} · {l.text} · {RECURRENCE_LABEL[d.recurrence as Recurrence] ?? d.recurrence}{d.note ? ` · ${d.note}` : ""}</span>
                  </span>
                  <span className="flex gap-1.5">
                    <form action={completeDeadlineAction}><input type="hidden" name="id" value={d.id} /><button className={primary}>Fait</button></form>
                    <form action={deleteDeadline}><input type="hidden" name="id" value={d.id} /><button className={ghost} aria-label={`Supprimer ${d.title}`}>×</button></form>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-1 text-sm text-muted">Aucune échéance. Ajoutez déclarations, assurance, renouvellement du domaine…</p>}
        <form action={addDeadline} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input name="title" required minLength={2} maxLength={160} placeholder="Ex. : déclaration trimestrielle" className={input} aria-label="Échéance" />
          <input name="dueAt" type="date" required min={today} className={input} aria-label="Date" />
          <select name="recurrence" className={input} aria-label="Répétition" defaultValue="none">
            {RECURRENCES.map((r) => <option key={r} value={r}>{RECURRENCE_LABEL[r]}</option>)}
          </select>
          <button className={primary + " justify-self-start"}>Ajouter</button>
        </form>
        <p className="mt-2 text-xs text-muted">Rappel par e-mail à J-15 et J-3. Une échéance répétée revient d’elle-même une fois marquée faite.</p>
      </section>

      <section id="demandes" className="mt-4 rounded-xl border border-line bg-white p-4">
        <h2 className="font-bold">Demandes sur les données</h2>
        {requests.length ? (
          <ul className="mt-2 divide-y divide-line">
            {requests.map((r) => {
              const l = left(r.dueAt, now);
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span className="min-w-0 text-sm">
                    <b>{PRIVACY_LABEL[r.kind as PrivacyKind] ?? r.kind}</b> · {r.email}
                    <span className={"block text-xs " + (l.late ? "font-semibold text-red-800" : "text-muted")}>Réponse avant le {DAY.format(r.dueAt)} · {l.text}{r.note ? ` · ${r.note}` : ""}</span>
                    {r.leadId && (
                      <span className="mt-0.5 flex gap-3 text-xs">
                        <Link href={`/admin/leads/${r.leadId}`} className="underline">Fiche</Link>
                        {r.kind === "access" && <a href={`/admin/leads/${r.leadId}/donnees`} className="underline">Télécharger ses données</a>}
                      </span>
                    )}
                  </span>
                  <form action={completePrivacyRequest}><input type="hidden" name="id" value={r.id} /><button className={primary}>Traitée</button></form>
                </li>
              );
            })}
          </ul>
        ) : <p className="mt-1 text-sm text-muted">Aucune demande en cours.</p>}
        <form action={addPrivacyRequest} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <input name="email" type="email" required placeholder="E-mail de la personne" className={input} aria-label="E-mail" />
          <select name="kind" className={input} aria-label="Type de demande" defaultValue="access">
            {PRIVACY_KINDS.map((k) => <option key={k} value={k}>{PRIVACY_LABEL[k]}</option>)}
          </select>
          <input name="receivedAt" type="date" required max={today} defaultValue={today} className={input} aria-label="Reçue le" />
          <button className={primary + " justify-self-start"}>Enregistrer</button>
        </form>
        <p className="mt-2 text-xs text-muted">Un mois pour répondre. Suppression : bouton en bas de la fiche (une personne qui a payé est anonymisée, ses reçus restent).</p>
      </section>

      <section id="conservation" className="mt-4 rounded-xl border border-line bg-white p-4">
        <h2 className="font-bold">Conservation</h2>
        {candidates.length ? (
          <form action={purgeRetention} className="mt-1 grid gap-2 text-sm">
            <p><b>{candidates.length} prospect{candidates.length > 1 ? "s" : ""}</b> sans paiement ni activité depuis {RETENTION_YEARS} ans : {candidates.slice(0, 5).map((c) => c.name).join(", ")}{candidates.length > 5 ? "…" : ""}</p>
            <label className="flex items-center gap-2"><input type="checkbox" name="confirm" required /> Je confirme la suppression définitive</label>
            <button className="justify-self-start rounded-lg bg-red-700 px-3 py-1.5 text-sm font-bold text-white">Supprimer</button>
          </form>
        ) : <p className="mt-1 text-sm text-muted">Rien à supprimer : aucun prospect sans paiement n’est inactif depuis {RETENTION_YEARS} ans.</p>}
      </section>

      <form id="identite" action={saveBusinessAction} className="mt-4 grid gap-2 rounded-xl border border-line bg-white p-4">
        <h2 className="font-bold">Identité de l’entreprise</h2>
        <p className="text-xs text-muted">Imprimée sur chaque reçu. Les mentions obligatoires dépendent de votre pays : faites-les valider par votre comptable.</p>
        {([
          ["legalName", "Raison sociale ou nom commercial", 160],
          ["address", "Adresse", 300],
          ["country", "Pays", 60],
          ["registration", "Immatriculation (RCCM, SIRET…)", 120],
          ["taxId", "Identifiant fiscal", 80],
          ["email", "E-mail de facturation", 180],
        ] as const).map(([name, label, max]) => (
          <label key={name} className="grid gap-1 text-sm"><span className="font-semibold">{label}</span><input name={name} maxLength={max} type={name === "email" ? "email" : "text"} defaultValue={business[name]} className={input} /></label>
        ))}
        <label className="grid gap-1 text-sm"><span className="font-semibold">Mentions en bas du reçu</span><textarea name="mentions" maxLength={600} rows={3} defaultValue={business.mentions} placeholder="Ce reçu atteste du paiement de la formation. Il ne constitue pas une facture avec TVA." className={input} /></label>
        <button className={primary + " justify-self-start"}>Enregistrer</button>
      </form>

      <p className="mt-4 flex flex-wrap gap-2 text-xs">
        <Link href="/admin/administratif/registre" className="rounded-full bg-slate-100 px-2.5 py-1 text-muted hover:underline">Registre des traitements</Link>
        <Link href="/admin/garde-fous" className="rounded-full bg-slate-100 px-2.5 py-1 text-muted hover:underline">Garde-fous</Link>
      </p>
    </main>
  );
}
