import Link from "next/link";
import { notFound } from "next/navigation";

import type { ProfileAnalysis } from "@/lib/analysis";
import { prisma } from "@/lib/db";
import { formatUsdCents } from "@/lib/pricing";
import { waMeLink } from "@/lib/messaging/templates";

import { deleteLead, markLost, registerManually, scheduleFollowup, updateLead } from "../actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { new: "Nouveau", contacted: "Contacté", booked: "RDV pris", called: "Appelé", registered: "Inscrit", nurture: "À recontacter", lost: "Perdu" };
const READINESS: Record<string, string> = { ready: "Prêt", conditional: "Sous conditions", not_yet: "Pas encore" };
const LOG: Record<string, string> = {
  scanner_submitted: "Scanner rempli", sales_message_drafted: "Message de relance rédigé", diagnosis_sent: "Message de relance envoyé", diagnosis_approved_email_failed: "Message validé, e-mail non parti",
  call_booked: "Appel réservé", call_rescheduled: "Appel déplacé", call_cancelled: "Appel annulé", call_outcome: "Issue de l'appel",
  followup_sent: "Relance envoyée", followup_postponed: "Relance reportée", invited_to_book: "Invité à réserver",
  registration_started: "Inscription commencée", registration_manual_opened: "Inscription manuelle ouverte", payment_confirmed: "Paiement confirmé", payment_confirmed_manually: "Paiement confirmé à la main", payment_amount_mismatch: "Montant inattendu",
  unsubscribed: "Désinscrit", marked_lost: "Marqué perdu",
};

/** Lead sheet (SPECS A7): timeline, scanner, notes, status, tags, actions. */
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id: Number(id) },
    include: {
      scannerResponses: { orderBy: { createdAt: "desc" }, take: 1 },
      bookings: { orderBy: { startsAt: "desc" }, take: 5 },
      registrations: { orderBy: { createdAt: "desc" }, include: { cohort: { select: { name: true } } } },
      actions: { orderBy: { createdAt: "desc" }, take: 40 },
      pricingTier: true,
    },
  });
  if (!lead) notFound();

  const response = lead.scannerResponses[0];
  const analysis = response?.analysis as ProfileAnalysis | undefined;
  const tags = Array.isArray(lead.tags) ? (lead.tags as string[]) : [];
  const toLocal = (d: Date | null) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : "");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin/leads" className="text-sm text-muted">← Leads</Link>
      <header className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{lead.firstName} {lead.lastName}</h1>
          <p className="text-sm text-muted">{lead.country} · {lead.pricingTier.label} · {STATUS[lead.status]}{lead.jobTitle ? ` · ${lead.jobTitle}` : ""}</p>
          <p className="mt-1 text-sm">
            <a href={`mailto:${lead.email}`} className="underline">{lead.email}</a>
            {lead.whatsapp && <> · <a href={waMeLink(lead.whatsapp, `Bonjour ${lead.firstName}, `)} target="_blank" rel="noopener" className="underline">WhatsApp</a></>}
            {lead.unsubscribedAt && <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-800">désinscrit</span>}
          </p>
        </div>
        <div className="shrink-0 text-right"><p className="display text-4xl font-black" style={{ color: lead.heatScore >= 60 ? "#b91c1c" : "#071a33" }}>{lead.heatScore}</p><p className="text-xs text-muted">chaleur</p></div>
      </header>

      {analysis && (
        <section className="mt-5 rounded-xl border border-line bg-white p-4">
          <div className="flex items-baseline justify-between"><p className="font-bold">{READINESS[analysis.readiness]}</p>{response && <Link href={`/admin/diagnostics/${response.id}`} className="text-sm underline">Message de relance</Link>}</div>
          <p className="text-sm text-muted">{analysis.headline} · {analysis.timeline.label} accompagné</p>
          <ul className="mt-2 grid gap-1 text-sm">{analysis.axes.map((a) => <li key={a.key}><b>{a.label}</b> — {a.detail}</li>)}</ul>
          {lead.goals && <p className="mt-3 rounded-lg bg-slate-50 p-2 text-sm whitespace-pre-line">{lead.goals}</p>}
        </section>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {lead.scannerResponses[0] && lead.status !== "registered" && <a href={`/rdv?t=${lead.scannerResponses[0].resultToken}`} className={ghost}>Lien de réservation</a>}
        <form action={scheduleFollowup}><input type="hidden" name="leadId" value={lead.id} /><button className={ghost}>Relancer dans 3 j</button></form>
        {!lead.registrations.some((r) => r.status === "paid") && <form action={registerManually}><input type="hidden" name="leadId" value={lead.id} /><button className={ghost}>Inscrire manuellement</button></form>}
        {lead.status !== "lost" && <form action={markLost}><input type="hidden" name="leadId" value={lead.id} /><button className={ghost}>Marquer perdu</button></form>}
      </div>

      <form action={updateLead} className="mt-5 grid gap-3 rounded-xl border border-line bg-white p-4">
        <input type="hidden" name="leadId" value={lead.id} />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Statut</span>
            <select name="status" defaultValue={lead.status} className={input}>{Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Prochaine relance</span><input type="datetime-local" name="nextFollowupAt" defaultValue={toLocal(lead.nextFollowupAt)} className={input} /></label>
        </div>
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Tags, séparés par des virgules</span><input name="tags" defaultValue={tags.join(", ")} placeholder="entreprise, financement, urgent" className={input} /></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Notes</span><textarea name="notes" rows={4} defaultValue={lead.notes ?? ""} className={input} /></label>
        <div className="flex justify-end"><button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Enregistrer</button></div>
      </form>

      {(lead.bookings.length > 0 || lead.registrations.length > 0) && (
        <section className="mt-5 grid gap-2 text-sm">
          {lead.bookings.map((b) => <p key={b.id} className="rounded-lg border border-line bg-white px-3 py-2">Appel {b.startsAt.toLocaleString("fr-FR")} · {b.status}{b.outcome ? ` · ${b.outcome}` : ""}{b.meetUrl && <> · <a href={b.meetUrl} className="underline">Meet</a></>}</p>)}
          {lead.registrations.map((r) => <p key={r.id} className="rounded-lg border border-line bg-white px-3 py-2">{r.cohort.name} · {formatUsdCents(r.amountUsd)} · {r.method} · {r.status} · {r.reference}{r.status === "paid" && <> · <a href={`/inscription/recu/${r.reference}`} className="underline">Reçu</a></>}</p>)}
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-extrabold tracking-[.06em] text-muted uppercase">Historique</h2>
        <ol className="mt-2 grid gap-1 text-sm">
          {lead.actions.map((a) => <li key={a.id} className="flex gap-3"><span className="w-32 shrink-0 text-muted">{a.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span><span>{LOG[a.type] ?? a.type}{a.channel ? ` (${a.channel})` : ""}</span></li>)}
          <li className="flex gap-3"><span className="w-32 shrink-0 text-muted">{lead.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span><span>Lead créé{lead.source ? ` · ${lead.source}` : ""}{lead.consentAt ? " · consentement donné" : ""}</span></li>
        </ol>
      </section>

      <form action={deleteLead} className="mt-10 border-t border-line pt-4">
        <input type="hidden" name="leadId" value={lead.id} />
        <button className="text-sm text-red-700 underline">Supprimer ce lead et tout son historique</button>
        <p className="mt-1 text-xs text-muted">Irréversible. À utiliser sur demande du prospect (RGPD).</p>
      </form>
    </main>
  );
}

const input = "rounded-lg border border-line px-3 py-2 text-base";
const ghost = "rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold";
