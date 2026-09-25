import { BellRing, CalendarCheck, CalendarPlus, Compass, FileText, Filter, Flame, GraduationCap, type LucideIcon, Mail, MessageSquareQuote, MessageSquareText, PhoneCall, LayoutDashboard, Settings2, Tag, Timer, Users, Wallet } from "lucide-react";
import Link from "next/link";

import { auth } from "@/auth";
import { loadQueue } from "@/lib/action-queue";
import { formatUsdCents } from "@/lib/pricing";

import { confirmManualPayment, followupPostpone, followupSent, inviteToBook, markCallOutcome, releaseHoldAction } from "./actions";
import { markSessionOutcome, remindSessionBooking } from "./conseil/actions";

export const dynamic = "force-dynamic";

const READINESS: Record<string, string> = { ready: "Éligible", conditional: "Associate", not_yet: "Fondations (CC)" };

/**
 * Admin home = the day's queue (SPECS A6). Three numbers, then the actions in
 * priority order, each with its button. Nothing else to open to run the day.
 */
export default async function AdminHomePage() {
  const [session, { items, kpis }] = await Promise.all([auth(), loadQueue()]);
  const groups = {
    review: items.filter((i) => i.kind === "review"),
    call: items.filter((i) => i.kind === "call"),
    followup: items.filter((i) => i.kind === "followup"),
    payment: items.filter((i) => i.kind === "payment"),
    hot: items.filter((i) => i.kind === "hot"),
    hold: items.filter((i) => i.kind === "hold"),
    session: items.filter((i) => i.kind === "session"),
  };

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><LayoutDashboard className="size-6 text-accent" aria-hidden />Aujourd&apos;hui</h1>
        <span className="text-xs text-muted">{session?.user?.email}</span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Kpi icon={Users} label="Leads cette semaine" value={String(kpis.leadsThisWeek)} />
        <Kpi icon={CalendarCheck} label="RDV cette semaine" value={String(kpis.callsThisWeek)} />
        <Kpi icon={GraduationCap} label={kpis.cohortName ?? "Cohorte"} value={`${kpis.confirmed} / ${kpis.capacity}`} />
      </div>

      {items.length === 0 && <p className="mt-8 rounded-xl border border-line bg-white p-4 text-muted">Rien à faire aujourd&apos;hui. La prospection continue : deux publications par semaine, les groupes, les anciens participants.</p>}

      <Group icon={MessageSquareText} title="Messages de relance à valider" count={groups.review.length}>
        {groups.review.map((i) => i.kind === "review" && (
          <Row key={`r${i.id}`} name={i.name} meta={`${i.country} · ${READINESS[i.readiness]} · ${i.late ? `en attente depuis ${i.hoursWaiting} h` : `il y a ${i.hoursWaiting} h`}`} heat={i.heat} late={i.late} leadId={i.leadId}>
            <Link href={`/admin/diagnostics/${i.id}`} className={primary}>Valider</Link>
          </Row>
        ))}
      </Group>

      <Group icon={PhoneCall} title="Appels et séances du jour" count={groups.call.length}>
        {groups.call.map((i) => i.kind === "call" && (
          <Row key={`c${i.bookingId}`} name={i.name} meta={i.consulting ? `${i.when} · Conseil : ${i.consulting.service}${i.consulting.total > 1 ? ` (séance ${i.consulting.number}/${i.consulting.total})` : ""}` : `${i.when} · ${i.readiness ? READINESS[i.readiness] : "sans scanner"}${i.timeline ? ` · ${i.timeline}` : ""}`} heat={i.heat} leadId={i.leadId} note={i.goals}>
            {i.meetUrl && <a href={i.meetUrl} target="_blank" rel="noopener" className={ghost}>Meet</a>}
            {i.consulting ? (
              <form action={markSessionOutcome} className="flex gap-1">
                <input type="hidden" name="bookingId" value={i.bookingId} />
                <select name="outcome" className="rounded-lg border border-line px-2 py-1.5 text-sm" defaultValue="done"><option value="done">Séance faite</option><option value="no_show">Absent</option></select>
                <button className={primary}>Marquer</button>
              </form>
            ) : (
            <form action={markCallOutcome} className="flex gap-1">
              <input type="hidden" name="bookingId" value={i.bookingId} />
              <select name="outcome" className="rounded-lg border border-line px-2 py-1.5 text-sm" defaultValue="registered">
                <option value="registered">Inscrit</option><option value="to_follow_up">À relancer</option><option value="not_now">Pas maintenant</option><option value="not_qualified">Non qualifié</option><option value="no_show">Absent</option>
              </select>
              <button className={primary}>Marquer</button>
            </form>
            )}
          </Row>
        ))}
      </Group>

      <Group icon={CalendarPlus} title="Séances payées à réserver" count={groups.session.length}>
        {groups.session.map((i) => i.kind === "session" && (
          <Row key={`s${i.orderId}`} name={i.name} meta={`${i.service} · séance ${i.number}/${i.total} · payée il y a ${i.daysSincePaid} j`} leadId={i.leadId}>
            <form action={remindSessionBooking}><input type="hidden" name="orderId" value={i.orderId} /><button className={ghost}>Renvoyer le lien</button></form>
          </Row>
        ))}
      </Group>

      <Group icon={BellRing} title="Relances dues" count={groups.followup.length}>
        {groups.followup.map((i) => i.kind === "followup" && (
          <Row key={`f${i.leadId}`} name={i.name} meta={`${i.stage}${i.overdueDays > 0 ? ` · en retard de ${i.overdueDays} j` : ""}`} heat={i.heat} leadId={i.leadId} note={i.emailBody}>
            {i.waLink && <a href={i.waLink} target="_blank" rel="noopener" className={primary}>WhatsApp</a>}
            <a href={`mailto:${i.email}?subject=${encodeURIComponent(i.emailSubject)}&body=${encodeURIComponent(i.emailBody)}`} className={ghost}>E-mail</a>
            <form action={followupSent}><input type="hidden" name="leadId" value={i.leadId} /><input type="hidden" name="channel" value={i.waLink ? "whatsapp" : "email"} /><button className={ghost}>Envoyé</button></form>
            <form action={followupPostpone}><input type="hidden" name="leadId" value={i.leadId} /><button className="px-2 py-1.5 text-sm text-muted underline">Reporter</button></form>
          </Row>
        ))}
      </Group>

      <Group icon={Wallet} title="Paiements à confirmer" count={groups.payment.length}>
        {groups.payment.map((i) => i.kind === "payment" && (
          <Row key={`p${i.registrationId}`} name={i.name} meta={`${i.reference} · ${formatUsdCents(i.amountUsd)} · ${i.cohortName} · il y a ${i.ageHours} h`} leadId={i.leadId}>
            <form action={confirmManualPayment} className="flex gap-1">
              <input type="hidden" name="registrationId" value={i.registrationId} />
              <input name="transactionId" placeholder="N° transaction" className="w-32 rounded-lg border border-line px-2 py-1.5 text-sm" />
              <button className={primary}>Confirmer</button>
            </form>
          </Row>
        ))}
      </Group>

      <Group icon={Timer} title="Places tenues" count={groups.hold.length}>
        {groups.hold.map((i) => i.kind === "hold" && (
          <Row key={`h${i.holdId}`} name={i.name} meta={`${i.cohortName} · libérée dans ${i.hoursLeft} h${i.reminded ? " · rappel envoyé" : ""}`} leadId={i.leadId}>
            <form action={releaseHoldAction}><input type="hidden" name="holdId" value={i.holdId} /><input type="hidden" name="leadId" value={i.leadId} /><button className={ghost}>Libérer</button></form>
          </Row>
        ))}
      </Group>

      <Group icon={Flame} title="Nouveaux leads chauds" count={groups.hot.length}>
        {groups.hot.map((i) => i.kind === "hot" && (
          <Row key={`h${i.leadId}`} name={i.name} meta={i.readiness ? READINESS[i.readiness] : ""} heat={i.heat} leadId={i.leadId} note={i.inviteBody}>
            {i.waLink && <a href={i.waLink} target="_blank" rel="noopener" className={primary}>Inviter (WhatsApp)</a>}
            <a href={`mailto:${i.email}?subject=${encodeURIComponent("15 minutes pour en parler ?")}&body=${encodeURIComponent(i.inviteBody)}`} className={ghost}>E-mail</a>
            <form action={inviteToBook}><input type="hidden" name="leadId" value={i.leadId} /><button className={ghost}>Fait</button></form>
          </Row>
        ))}
      </Group>

      <nav className="mt-10 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2.5 font-semibold hover:border-ink"><Icon className="size-4 shrink-0 text-accent" aria-hidden />{label}</Link>
        ))}
      </nav>
    </main>
  );
}

/** The admin sections, each with its icon (Ben, 25/09). */
const NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/admin/leads", label: "Tous les leads", icon: Users },
  { href: "/admin/tunnel", label: "Tunnel", icon: Filter },
  { href: "/admin/cohortes", label: "Cohortes", icon: GraduationCap },
  { href: "/admin/conseil", label: "Conseil", icon: Compass },
  { href: "/admin/temoignages", label: "Témoignages", icon: MessageSquareQuote },
  { href: "/admin/parametres/site", label: "Page d'accueil", icon: Settings2 },
  { href: "/admin/parametres/prix", label: "Tarifs", icon: Tag },
  { href: "/admin/parametres/gabarits", label: "Gabarits", icon: Mail },
  { href: "/admin/documents", label: "Documents", icon: FileText },
  { href: "/admin/parametres/google", label: "Agenda", icon: CalendarCheck },
];

function Kpi({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="rounded-xl border border-line bg-white px-3 py-2.5"><div className="flex items-center justify-between gap-2"><div className="display text-2xl font-black">{value}</div><Icon className="size-5 shrink-0 text-accent" aria-hidden /></div><div className="truncate text-xs text-muted">{label}</div></div>;
}

function Group({ icon: Icon, title, count, children }: { icon: LucideIcon; title: string; count: number; children: React.ReactNode }) {
  if (count === 0) return null;
  return <section className="mt-7"><h2 className="mb-2 flex items-center justify-between text-sm font-extrabold tracking-[.06em] text-muted uppercase"><span className="flex items-center gap-2"><Icon className="size-4 text-accent" aria-hidden />{title}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{count}</span></h2><ul className="grid gap-2">{children}</ul></section>;
}

function Row({ name, meta, heat, late, leadId, note, children }: { name: string; meta: string; heat?: number; late?: boolean; leadId: number; note?: string | null; children: React.ReactNode }) {
  return (
    <li className={`rounded-xl border bg-white p-3.5 ${late ? "border-red-300 bg-red-50" : "border-line"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/leads/${leadId}`} className="font-bold hover:underline">{name}</Link>
          <p className="text-sm text-muted">{meta}</p>
        </div>
        {heat !== undefined && <span className="shrink-0 rounded-full px-2.5 py-0.5 text-sm font-black text-white" style={{ background: heat >= 60 ? "#b91c1c" : heat >= 30 ? "#c2410c" : "#64748b" }}>{heat}</span>}
      </div>
      {note && <details className="mt-2 text-sm text-ink-2"><summary className="cursor-pointer text-muted">Voir le message</summary><p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-2">{note}</p></details>}
      <div className="mt-3 flex flex-wrap items-center gap-2">{children}</div>
    </li>
  );
}

const primary = "rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-white";
const ghost = "rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold";
