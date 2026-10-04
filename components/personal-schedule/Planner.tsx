"use client";

import { CalendarCheck, ChevronDown, Send } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { proposeAction } from "@/app/(public)/calendrier/[token]/actions";
import {
  PERSONAL_ZONE_LABEL,
  type PersonalDay,
  TOTAL_HOURS,
  WEEKDAY_HOURS,
  WEEKEND_HOURS,
  WEEKEND_PAUSE_MINUTES,
  clockLabel,
  dayMinutes,
  mockExamDate,
  personalSessions,
  placedHours,
} from "@/lib/personal-schedule";

export type PlannerDay = { date: string; weekend: boolean; options: number[]; optionsExtended: number[]; utcShift: number };
type Status = "invited" | "proposed" | "confirmed" | "refused";

const fmt = (date: string, o: Intl.DateTimeFormatOptions) => new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC", ...o });
const long = (date: string) => fmt(date, { weekday: "long", day: "numeric", month: "long" });
const hrs = (h: number) => (h % 1 ? `${Math.floor(h)} h 30` : `${h} h`);
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * The participant's calendar (Ben, 04/10, prototype validated the same day):
 * a month grid to tick days, the course packed live into them, one open day
 * at a time to set its hour, then "send to Ben". Montréal hours, with the
 * participant's own local time alongside.
 */
export function Planner({ token, firstName, cohortName, status, refusalNote, days, chosen, calendarConnected, planUrl }: {
  token: string; firstName: string; cohortName: string; status: Status; refusalNote: string | null;
  days: PlannerDay[]; chosen: PersonalDay[]; calendarConnected: boolean; planUrl: string | null;
}) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const editable = status === "invited" || status === "refused";
  const [picked, setPicked] = useState<Map<string, { start: number; extend: boolean }>>(() => {
    const m = new Map<string, { start: number; extend: boolean }>();
    for (const c of chosen) {
      const d = byDate.get(c.date);
      if (!editable || (d && (c.extend ? d.optionsExtended : d.options).includes(c.start))) m.set(c.date, { start: c.start, extend: c.extend });
    }
    return m;
  });
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, run] = useTransition();
  const locked = !editable || sent;

  const list: PersonalDay[] = [...picked.entries()].map(([date, p]) => ({ date, ...p })).sort((a, b) => a.date.localeCompare(b.date));
  const sessions = personalSessions(list);
  const placed = placedHours(sessions);
  const complete = placed >= TOTAL_HOURS;
  const extra = list.slice(sessions.length).map((d) => d.date);
  const last = complete ? sessions[sessions.length - 1].date : null;
  const mock = complete ? mockExamDate(sessions) : null;
  // null: nothing chosen yet, the first day opens; "": every day folded.
  const shownOpen = openDay === "" ? null : openDay && picked.has(openDay) ? openDay : list[0]?.date ?? null;

  const localTime = (date: string, minutes: number) => {
    const d = byDate.get(date);
    if (!d) return "";
    const at = new Date(Date.parse(`${date}T00:00:00Z`) + (minutes + d.utcShift) * 60_000);
    return at.toLocaleTimeString("fr-FR", { hour: "numeric", minute: "2-digit" }).replace(":", " h ").replace(" h 00", " h");
  };
  const sameZone = days.every((d) => localTime(d.date, 600) === "10 h");

  const toggle = (date: string) => {
    if (locked) return;
    const d = byDate.get(date)!;
    const next = new Map(picked);
    if (next.has(date)) next.delete(date);
    else {
      const start = d.weekend ? d.options[0] : d.options.find((m) => m >= 18 * 60) ?? d.options[0];
      next.set(date, { start, extend: false });
      setOpenDay(date);
    }
    setPicked(next);
  };
  const update = (date: string, change: Partial<{ start: number; extend: boolean }>) => {
    const d = byDate.get(date)!;
    const cur = { ...picked.get(date)!, ...change };
    const allowed = cur.extend ? d.optionsExtended : d.options;
    if (!allowed.includes(cur.start)) cur.start = allowed.filter((m) => m <= cur.start).pop() ?? allowed[0];
    setPicked(new Map(picked).set(date, cur));
  };
  const submit = () =>
    run(async () => {
      const r = await proposeAction({ token, days: list.slice(0, sessions.length) });
      setResult(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error });
      if (r.ok) setSent(true);
    });

  const lead = (new Date(`${days[0].date}T12:00:00Z`).getUTCDay() + 6) % 7;

  return (
    <main className="mx-auto grid w-full max-w-6xl flex-1 gap-5 px-4 py-6 sm:px-5">
      <section className="grid gap-2 rounded-[22px] bg-gradient-to-br from-ink to-ink-2 p-5 text-white shadow-[0_10px_24px_rgba(7,26,51,0.05)]">
        <span className="text-xs font-bold tracking-[.08em] text-accent-bright uppercase">CISSP Bootcamp · {cohortName}</span>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Bonjour {firstName}, choisissez vos jours de session</h1>
        {editable && !sent ? (
          <>
            <p className="text-white/80">Cochez dans le calendrier les jours où vous êtes disponible. Les {TOTAL_HOURS} h du programme se placent dans l&apos;ordre sur les jours choisis : {WEEKDAY_HOURS} h un soir de semaine, {hrs(WEEKEND_HOURS)} un jour de week-end, ou 6 h 30 si vous le prolongez à 7 h pause comprise. Quand tout tient, envoyez votre proposition : Ben la confirme, puis vous recevez les invitations Google Agenda.</p>
            <p className="text-sm text-white/70">Jours proposés jusqu&apos;au <b>{long(days[days.length - 1].date)}</b>. Les heures sont en {PERSONAL_ZONE_LABEL}{sameZone ? "" : " ; l’heure chez vous est indiquée à côté"}.</p>
          </>
        ) : status === "confirmed" ? (
          <p className="text-white/80">Votre calendrier est confirmé. Vos invitations Google Agenda, avec le lien Meet de chaque session, sont dans votre agenda.</p>
        ) : (
          <p className="text-white/80">Votre proposition est envoyée. Ben la regarde et la confirme ; vous recevrez ensuite une invitation Google Agenda par session.</p>
        )}
      </section>

      {status === "refused" && refusalNote && !sent && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><b>Message de Ben sur votre proposition précédente :</b> {refusalNote}</p>
      )}
      {editable && !calendarConnected && !sent && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Les disponibilités de Ben n&apos;ont pas pu être lues : tous les jours sont ouverts, Ben vérifiera à la confirmation.</p>
      )}

      <section className="grid gap-2 rounded-[22px] border border-line bg-white p-4 shadow-[0_10px_24px_rgba(7,26,51,0.05)]" aria-live="polite">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span><b className="tabular-nums">{hrs(placed)}</b> placées sur {TOTAL_HOURS} h</span>
          <span><b className="tabular-nums">{sessions.length}</b> session{sessions.length > 1 ? "s" : ""}</span>
          <span>Dernière session : <b>{last ? long(last) : "—"}</b></span>
          <span>Examen blanc : <b>{mock ? long(mock) : "—"}</b></span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_HOURS} aria-valuenow={placed}>
          <i className="block h-full bg-accent transition-[width] motion-reduce:transition-none" style={{ width: `${Math.min(100, (placed / TOTAL_HOURS) * 100)}%` }} />
        </div>
        {editable && !sent && (
          <p className="text-xs text-muted">
            {complete
              ? extra.length ? `Les ${TOTAL_HOURS} h tiennent. ${extra.length} jour(s) coché(s) en trop : ils ne seront pas utilisés.` : `Les ${TOTAL_HOURS} h tiennent : vous pouvez envoyer votre proposition.`
              : `Il manque ${hrs(TOTAL_HOURS - placed)}. Par exemple ${Math.ceil((TOTAL_HOURS - placed) / WEEKDAY_HOURS)} soirs de semaine, ou ${Math.ceil((TOTAL_HOURS - placed) / WEEKEND_HOURS)} jours de week-end.`}
          </p>
        )}
      </section>

      <div className={editable && !sent ? "grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" : "grid gap-5"}>
        {editable && !sent && (
          <section className="rounded-[22px] border border-line bg-white p-4 shadow-[0_10px_24px_rgba(7,26,51,0.05)]">
            <h2 className="text-lg font-extrabold">Vos jours disponibles</h2>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => <div key={d} className="pb-0.5 text-center text-[11px] font-bold tracking-[.06em] text-muted uppercase">{d}</div>)}
              {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} />)}
              {days.map((d) => {
                const p = picked.get(d.date);
                const session = sessions.find((s) => s.date === d.date);
                const closed = d.options.length === 0;
                const isExtra = extra.includes(d.date);
                const tone = closed ? "border-dashed bg-slate-100 text-slate-400" : isExtra ? "border-amber-600 bg-amber-50 text-amber-800" : p ? "border-accent bg-accent-soft text-accent-ink ring-1 ring-accent" : d.weekend ? "border-line bg-[#f2f7ff] hover:border-accent" : "border-line bg-white hover:border-accent";
                const tag = closed ? "Indisponible" : isExtra ? "En trop" : session ? `J${session.n} · ${hrs(session.hours)}` : d.weekend ? hrs(WEEKEND_HOURS) : `${WEEKDAY_HOURS} h`;
                return (
                  <button key={d.date} type="button" disabled={closed} onClick={() => toggle(d.date)} aria-pressed={Boolean(p)} aria-label={`${long(d.date)}${closed ? ", indisponible" : session ? `, choisi, J${session.n}` : ""}`}
                    className={`grid min-h-[58px] content-start gap-0.5 rounded-xl border p-1.5 text-left sm:min-h-[74px] ${closed ? "cursor-not-allowed" : ""} ${tone}`}>
                    <span className="font-bold tabular-nums">{Number(d.date.slice(8))}</span>
                    <span className="text-[10px] opacity-80">{fmt(d.date, { month: "short" })}</span>
                    <span className="text-[10px] leading-tight font-bold sm:text-[11px]">{tag}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded border border-accent bg-accent-soft" />Choisi</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded border border-line bg-[#f2f7ff]" />Week-end</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded border border-dashed bg-slate-100" />Ben indisponible ou date passée</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded border border-amber-600 bg-amber-50" />En trop</span>
            </div>
          </section>
        )}

        <section className="rounded-[22px] border border-line bg-white p-4 shadow-[0_10px_24px_rgba(7,26,51,0.05)]">
          <h2 className="text-lg font-extrabold">Votre plan, jour par jour</h2>
          {editable && !sent && <p className="mt-1 text-xs text-muted">Ouvrez un jour pour choisir son heure de début ; ouvrir un autre jour referme le précédent. En semaine à partir de 16 h, le week-end à partir de 10 h ({PERSONAL_ZONE_LABEL}).</p>}
          <div className="mt-3 grid gap-2.5">
            {list.length === 0 && <p className="text-muted">Cochez un premier jour dans le calendrier.</p>}
            {list.map((day) => {
              const d = byDate.get(day.date);
              const session = sessions.find((s) => s.date === day.date);
              const end = day.start + dayMinutes(day.date, day.extend);
              const open = shownOpen === day.date;
              const opts = d ? (day.extend ? d.optionsExtended : d.options) : [];
              const local = `${localTime(day.date, day.start)} – ${localTime(day.date, end)}`;
              return (
                <div key={day.date} className={`rounded-2xl border ${!session ? "border-amber-600 bg-amber-50" : open ? "border-accent ring-3 ring-accent/10" : "border-line"}`}>
                  <button type="button" onClick={() => setOpenDay(open ? "" : day.date)} aria-expanded={open} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl px-3 py-2.5 text-left hover:bg-paper">
                    <span>
                      <span className="font-extrabold">{session ? `J${session.n}` : "—"}</span> <b>{long(day.date)}</b><br />
                      <span className="text-sm text-muted tabular-nums">{session ? `${clockLabel(day.start)}–${clockLabel(end)} · ${hrs(session.hours)}${day.extend ? " · prolongé" : ""}` : "En trop"}</span>
                    </span>
                    <ChevronDown className={`size-4 text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  {open && (
                    <div className="grid gap-2 px-3 pb-3 text-sm">
                      {session && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <label className="flex items-center gap-2">Début
                            <select value={day.start} disabled={locked} onChange={(e) => update(day.date, { start: Number(e.target.value) })} className="rounded-lg border border-line bg-white px-2 py-1 text-base">
                              {(locked ? [day.start] : opts).map((m) => <option key={m} value={m}>{clockLabel(m)}</option>)}
                            </select></label>
                          <span>fin {clockLabel(end)} <span className="text-muted">({PERSONAL_ZONE_LABEL})</span>{sameZone ? "" : <> · soit {local} chez vous</>}</span>
                          {d?.weekend && !locked && (
                            <label className="flex items-center gap-2"><input type="checkbox" checked={day.extend} disabled={!d.optionsExtended.length} onChange={(e) => update(day.date, { extend: e.target.checked })} />Prolonger jusqu&apos;à 7 h, pause comprise (6 h 30 de cours)</label>
                          )}
                          {d?.weekend && <span className="text-xs text-muted">Pause de {WEEKEND_PAUSE_MINUTES} min comprise.</span>}
                        </div>
                      )}
                      <p className="text-ink-2">{session ? session.title : "Plus nécessaire : le programme est déjà complet."}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {editable && !sent && (
            <div className="mt-4 grid gap-2">
              <button type="button" disabled={!complete || pending} onClick={submit} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold text-white disabled:opacity-45">
                <Send className="size-4" aria-hidden />{pending ? "Envoi…" : "Envoyer ma proposition à Ben"}
              </button>
              <p className="text-xs text-muted">Une fois confirmé par Ben, votre calendrier ne pourra plus être modifié.</p>
            </div>
          )}
          {result && <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${result.ok ? "bg-accent-soft text-accent-ink" : "bg-red-50 text-red-800"}`}>{result.ok ? <><b>Proposition envoyée.</b> Ben la regarde et la confirme ; vous recevrez ensuite une invitation Google Agenda par session, avec le lien Meet.</> : result.text}</p>}
          {(planUrl || sent) && (
            <a href={planUrl ?? `/plan-de-lecture?calendrier=${token}`} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 font-semibold">
              <CalendarCheck className="size-4 text-accent" aria-hidden />Mon plan de lecture, à mes dates
            </a>
          )}
          {mock && !editable && <p className="mt-3 text-sm text-muted">Examen blanc le {long(mock)}, une semaine après votre dernière session ({long(addDays(mock, -7))}).</p>}
        </section>
      </div>
    </main>
  );
}
