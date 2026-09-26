import { FileText, FlaskConical, History, UserCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import type { ProfileAnalysis } from "@/lib/analysis";
import { prisma } from "@/lib/db";
import { formatUsdCents } from "@/lib/pricing";
import { waMeLink } from "@/lib/messaging/templates";

import { syncLeadTests } from "@/lib/examboot/service";
import { HOLD_HOURS, activeHoldFor, formatDeadline } from "@/lib/seat-holds";

import { holdSeatAction, releaseHoldAction } from "@/app/admin/actions";

import { formatBytes } from "@/lib/documents";
import { planStart } from "@/lib/reading-plan/page";

import { deleteLead, markLost, registerDirectly, scheduleFollowup, sendOnboarding, updateLead } from "../actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { new: "Nouveau", contacted: "Contacté", booked: "RDV pris", called: "Appelé", registered: "Inscrit", nurture: "À recontacter", lost: "Perdu" };
const READINESS: Record<string, string> = { ready: "Éligible", conditional: "Associate", not_yet: "Fondations (CC)" };
const LOG: Record<string, string> = {
  scanner_submitted: "Scanner rempli", sales_message_drafted: "Message de relance rédigé", diagnosis_sent: "Message de relance envoyé", diagnosis_approved_email_failed: "Message validé, e-mail non parti",
  call_booked: "Appel réservé", call_rescheduled: "Appel déplacé", call_cancelled: "Appel annulé", call_outcome: "Issue de l'appel",
  followup_sent: "Relance envoyée", followup_postponed: "Relance reportée", invited_to_book: "Invité à réserver",
  registration_started: "Inscription commencée", registration_manual_opened: "Inscription manuelle ouverte", registered_by_admin: "Inscrit directement par Ben", moved_to_cohort: "Déplacé vers une autre cohorte", payment_confirmed: "Paiement confirmé", payment_confirmed_manually: "Paiement confirmé à la main", payment_amount_mismatch: "Montant inattendu",
  unsubscribed: "Désinscrit", marked_lost: "Marqué perdu",
  after_call_email: "Lien de paiement envoyé après l'appel", result_reminder: "Rappel J+1 envoyé", onboarding_sent: "Documents de préparation envoyés", onboarding_failed: "Documents de préparation : e-mail non parti",
  service_order_started: "Commande de conseil ouverte", service_paid: "Séance de conseil payée", session_booked: "Séance réservée", session_cancelled: "Séance annulée", session_outcome: "Séance faite / absent", session_booking_reminded: "Lien de réservation renvoyé",
};

/** Lead sheet (SPECS A7): timeline, scanner, notes, status, tags, actions. */
export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ onboarding?: string; inscription?: string }> }) {
  const { id } = await params;
  const { onboarding, inscription } = await searchParams;
  // Scores revealed since the last visit are pulled now, so the sheet is current.
  await syncLeadTests(Number(id));
  const lead = await prisma.lead.findUnique({
    where: { id: Number(id) },
    include: {
      scannerResponses: { orderBy: { createdAt: "desc" }, take: 1 },
      bookings: { orderBy: { startsAt: "desc" }, take: 5 },
      registrations: { orderBy: { createdAt: "desc" }, include: { cohort: { select: { name: true, program: true, startsAt: true } } } },
      serviceOrders: { orderBy: { createdAt: "desc" }, include: { service: { select: { name: true } }, bookings: { where: { status: { in: ["scheduled", "done"] } }, select: { id: true } } } },
      actions: { orderBy: { createdAt: "desc" }, take: 40 },
      practiceTests: { orderBy: { createdAt: "desc" }, take: 5 },
      pricingTier: true,
    },
  });
  if (!lead) notFound();

  const response = lead.scannerResponses[0];
  const hold = await activeHoldFor(lead.id);
  const holdRefusal = lead.status !== "registered" ? await prisma.actionLog.findFirst({ where: { leadId: lead.id, type: "seat_hold_refused", createdAt: { gt: new Date(Date.now() - 60_000) } }, orderBy: { createdAt: "desc" } }) : null;
  const analysis = response?.analysis as ProfileAnalysis | undefined;
  const paidRegistration = lead.registrations.find((r) => r.status === "paid");
  const documents = paidRegistration
    ? await prisma.document.findMany({ where: { program: paidRegistration.cohort.program, active: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, filename: true, size: true } })
    : [];
  const lastOnboarding = lead.actions.find((a) => a.type === "onboarding_sent");
  const cohorts = await prisma.cohort.findMany({
    where: { status: { not: "done" } },
    orderBy: { startsAt: "asc" },
    select: { id: true, name: true, program: true, startsAt: true, capacity: true, status: true, _count: { select: { registrations: { where: { status: "paid" } } } } },
  });
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
        {lead.status !== "lost" && <form action={markLost}><input type="hidden" name="leadId" value={lead.id} /><button className={ghost}>Marquer perdu</button></form>}
        {!hold && lead.status !== "registered" && lead.status !== "lost" && <form action={holdSeatAction}><input type="hidden" name="leadId" value={lead.id} /><button className={ghost}>Tenir la place {HOLD_HOURS} h</button></form>}
      </div>
      {hold && (
        <p className="mt-3 rounded-lg border border-accent/20 bg-accent-soft px-3 py-2 text-sm">
          Place tenue dans la {hold.cohort.name} jusqu&apos;au {formatDeadline(hold.expiresAt)}{hold.reminderSentAt ? " · rappel envoyé" : ""}.
          <form action={releaseHoldAction} className="mt-1 inline"><input type="hidden" name="holdId" value={hold.id} /><input type="hidden" name="leadId" value={lead.id} /><button className="ml-2 underline">Libérer la place</button></form>
        </p>
      )}
      {holdRefusal && !hold && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Place non tenue : {String((holdRefusal.payload as { error?: string })?.error ?? "")}</p>}

      {lead.status === "registered" && !paidRegistration && (
        <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Marqué « Inscrit », mais cette personne n&apos;a encore aucune place dans une cohorte. Inscrivez-la ci-dessous : c&apos;est ce qui lui réserve sa place et lui envoie ses documents.</p>
      )}
      {inscription && (
        <p className={"mt-3 rounded-lg px-3 py-2 text-sm " + (inscription.startsWith("ok") ? "bg-accent-soft" : "bg-red-50 text-red-800")}>
          {inscription.startsWith("ok:") ? inscription.slice(3) : inscription}
        </p>
      )}
      <details open={!paidRegistration} className="mt-5 rounded-xl border-2 border-accent/40 bg-white p-4 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-semibold"><UserCheck className="size-4 text-accent" aria-hidden />{paidRegistration ? "Inscrire dans une autre cohorte" : "Inscrire dans une cohorte"}</summary>
        {cohorts.length === 0 ? (
          <p className="mt-3 text-muted">Aucune cohorte à venir. <Link href="/admin/cohortes" className="underline">Créer une cohorte</Link>.</p>
        ) : (
          <form action={registerDirectly} className="mt-3 grid gap-3">
            <input type="hidden" name="leadId" value={lead.id} />
            <p className="text-muted">Pour une personne qui a payé hors de l&apos;application. La place est confirmée tout de suite, même si la cohorte est pleine ou pas encore ouverte, et la personne passe en « Inscrit ».</p>
            <label className="flex flex-col gap-1"><span className="font-medium">Cohorte</span>
              <select name="cohortId" required className={input} defaultValue={cohorts.find((c) => c.status === "open")?.id ?? cohorts[0].id}>
                {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.program.toUpperCase()} · {c.startsAt.toLocaleDateString("fr-FR", { timeZone: "UTC" })} · {c._count.registrations}/{c.capacity} payées{c.status !== "open" ? ` · ${c.status === "full" ? "pleine" : c.status === "planned" ? "pas encore ouverte" : "en cours"}` : ""}</option>)}
              </select></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1"><span className="font-medium">Montant reçu (USD)</span>
                <input name="amountUsd" type="number" min="0" step="0.01" required defaultValue={lead.pricingTier && lead.pricingTier.amountUsd > 0 ? lead.pricingTier.amountUsd / 100 : undefined} className={input} /></label>
              <label className="flex flex-col gap-1"><span className="font-medium">Mode de paiement</span>
                <select name="paymentMode" required className={input} defaultValue="virement">
                  {["virement", "espèces", "mobile money hors application", "carte hors application", "offert", "autre"].map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select></label>
            </div>
            <label className="flex flex-col gap-1"><span className="font-medium">Précision, facultative</span><input name="paymentDetail" maxLength={150} placeholder="ex. référence du virement, payé par l’employeur" className={input} /></label>
            <label className="flex items-center gap-2"><input type="checkbox" name="notify" defaultChecked /> Envoyer l&apos;e-mail « votre place est réservée » avec le reçu</label>
            <label className="flex items-start gap-2"><input type="checkbox" name="onboard" defaultChecked className="mt-1" /> Envoyer aussi les documents de préparation : le plan de lecture (CISSP) et les documents actifs du programme, dans un second e-mail</label>
            <div className="flex justify-end"><button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Inscrire et envoyer</button></div>
          </form>
        )}
      </details>

      {paidRegistration ? (
        <section className="mt-5 rounded-xl border border-line bg-white p-4 text-sm">
          <h2 className="flex items-center gap-2 text-xs font-extrabold tracking-[.06em] text-muted uppercase"><FileText className="size-4 text-accent" aria-hidden />Documents de préparation</h2>
          {onboarding === "ok" && <p className="mt-2 rounded-lg bg-accent-soft px-3 py-2">E-mail d&apos;onboarding envoyé avec les documents.</p>}
          {onboarding && onboarding !== "ok" && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-red-800">{onboarding}</p>}
          {lastOnboarding && <p className="mt-2 text-muted">Dernier envoi le {lastOnboarding.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}.</p>}
          {documents.length === 0 && paidRegistration.cohort.program !== "cissp" ? (
            <p className="mt-2 text-muted">Aucun document actif pour cette formation. <Link href="/admin/documents" className="underline">Ajouter des documents</Link>.</p>
          ) : (
            <form action={sendOnboarding} className="mt-2 grid gap-2">
              <input type="hidden" name="leadId" value={lead.id} />
              {paidRegistration.cohort.program === "cissp" && (
                <p className="flex items-center gap-2"><input type="checkbox" checked disabled aria-label="Toujours inclus" /> Plan de lecture interactif <span className="text-muted">(lien, toujours inclus)</span> <a href={`/plan-de-lecture?debut=${planStart(paidRegistration.cohort.startsAt)}`} target="_blank" rel="noopener" className="underline">voir</a></p>
              )}
              {documents.map((d) => (
                <label key={d.id} className="flex items-center gap-2"><input type="checkbox" name="documentId" value={d.id} defaultChecked /> {d.name} <span className="text-muted">({formatBytes(d.size)})</span></label>
              ))}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-muted">Destinataire : {lead.email} · {paidRegistration.cohort.name}</span>
                <button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Envoyer l&apos;e-mail d&apos;onboarding</button>
              </div>
            </form>
          )}
        </section>
      ) : (
        <section className="mt-5 rounded-xl border border-dashed border-line bg-white p-4 text-sm">
          <h2 className="flex items-center gap-2 text-xs font-extrabold tracking-[.06em] text-muted uppercase"><FileText className="size-4 text-accent" aria-hidden />Documents de préparation</h2>
          <p className="mt-2 text-muted">Ils s&apos;envoient une fois la personne inscrite dans une cohorte, avec le bloc ci-dessus (case « Envoyer aussi les documents de préparation »).</p>
        </section>
      )}


      <form action={updateLead} className="mt-5 grid gap-3 rounded-xl border border-line bg-white p-4">
        <input type="hidden" name="leadId" value={lead.id} />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Étape de suivi</span>
            <select name="status" defaultValue={lead.status} className={input}>{Object.entries(STATUS).filter(([v]) => v !== "registered" || paidRegistration || lead.status === "registered").map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <span className="text-xs text-muted">Étape de suivi commercial. « Inscrit » vient d&apos;une place payée : utilisez « Inscrire dans une cohorte ».</span></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Prochaine relance</span><input type="datetime-local" name="nextFollowupAt" defaultValue={toLocal(lead.nextFollowupAt)} className={input} /></label>
        </div>
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Tags, séparés par des virgules</span><input name="tags" defaultValue={tags.join(", ")} placeholder="entreprise, financement, urgent" className={input} /></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Notes</span><textarea name="notes" rows={4} defaultValue={lead.notes ?? ""} className={input} /></label>
        <div className="flex justify-end"><button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Enregistrer</button></div>
      </form>

      {lead.practiceTests.length > 0 && (
        <section className="mt-5 rounded-xl border border-line bg-white p-4 text-sm">
          <h2 className="flex items-center gap-2 text-xs font-extrabold tracking-[.06em] text-muted uppercase"><FlaskConical className="size-4 text-accent" aria-hidden />Tests ExamBoot</h2>
          <ul className="mt-2 grid gap-1">
            {lead.practiceTests.map((t) => (
              <li key={t.id}>
                {t.createdAt.toLocaleDateString("fr-FR")} · {t.placement} · {t.status === "completed" ? <b>{t.percent} % ({t.correct}/{t.questions}{t.nickname ? `, ${t.nickname}` : ""})</b> : <span className="text-muted">pas encore de score</span>}
                {" "}<a href={t.url} target="_blank" rel="noopener" className="underline">ouvrir</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(lead.bookings.length > 0 || lead.registrations.length > 0 || lead.serviceOrders.length > 0) && (
        <section className="mt-5 grid gap-2 text-sm">
          {lead.bookings.map((b) => <p key={b.id} className="rounded-lg border border-line bg-white px-3 py-2">{b.kind === "consulting" ? "Séance de conseil" : "Appel"} {b.startsAt.toLocaleString("fr-FR")} · {b.status}{b.outcome ? ` · ${b.outcome}` : ""}{b.meetUrl && <> · <a href={b.meetUrl} className="underline">Meet</a></>}</p>)}
          {lead.serviceOrders.map((o) => <p key={o.id} className="rounded-lg border border-line bg-white px-3 py-2">Conseil : {o.service.name} · {formatUsdCents(o.amountUsd)} · {o.method} · {o.status} · {o.bookings.length}/{o.sessionsTotal} séance{o.sessionsTotal > 1 ? "s" : ""} · {o.reference}{o.status === "paid" && <> · <a href={`/conseil/rdv/${o.bookingToken}`} className="underline">lien de réservation</a></>}</p>)}
          {lead.registrations.map((r) => <p key={r.id} className="rounded-lg border border-line bg-white px-3 py-2">{r.cohort.name} · {formatUsdCents(r.amountUsd)} · {r.method} · {r.status} · {r.reference}{r.status === "paid" && <> · <a href={`/inscription/recu/${r.reference}`} className="underline">Reçu</a></>}</p>)}
        </section>
      )}

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-sm font-extrabold tracking-[.06em] text-muted uppercase"><History className="size-4 text-accent" aria-hidden />Historique</h2>
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
