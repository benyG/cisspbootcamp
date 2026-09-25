import { CalendarCheck } from "lucide-react";
import Link from "next/link";

import { getCredential } from "@/lib/calendar/google";
import { prisma } from "@/lib/db";

import {
  addAvailabilityRule,
  disconnectGoogle,
  removeAvailabilityRule,
  startGoogleConnect,
  updateCalendarSettings,
} from "./actions";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default async function GoogleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erreur?: string }>;
}) {
  const { ok, erreur } = await searchParams;
  const [credential, rules] = await Promise.all([
    getCredential(),
    prisma.availabilityRule.findMany({ orderBy: [{ weekday: "asc" }, { start: "asc" }] }),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-[var(--color-muted)]">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><CalendarCheck className="size-6 shrink-0 text-accent" aria-hidden />Agenda et disponibilités</h1>

      {ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">Agenda connecté.</p>}
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Connexion échouée : {erreur}</p>}

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">Google Calendar</h2>
        {credential ? (
          <>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Connecté avec <strong>{credential.accountEmail || "un compte Google"}</strong> le{" "}
              {credential.connectedAt.toLocaleDateString("fr-FR")}. Les appels de découverte
              atterrissent dans cet agenda.
            </p>
            <form action={updateCalendarSettings} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Fuseau horaire de vos disponibilités</span>
                <input name="timeZone" defaultValue={credential.timeZone} className={input} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">Identifiant d&apos;agenda</span>
                <input name="calendarId" defaultValue={credential.calendarId} className={input} />
              </label>
              <div className="sm:col-span-2 flex justify-between">
                <button formAction={disconnectGoogle} className="text-sm text-red-700 underline">
                  Déconnecter
                </button>
                <button type="submit" className={primary}>Enregistrer</button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Aucun agenda connecté : la page de réservation est fermée. Connectez le compte Google
              qui porte votre agenda — il peut être différent de celui qui ouvre cet admin.
            </p>
            <form action={startGoogleConnect} className="mt-4">
              <button type="submit" className={primary}>Connecter Google Calendar</button>
            </form>
          </>
        )}
      </section>

      {(["discovery", "consulting"] as const).map((kind) => (
      <section key={kind} className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="font-semibold">{kind === "discovery" ? "Plages des appels de découverte" : "Plages des séances de conseil"}</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {kind === "discovery"
            ? "Chaque plage est découpée en appels de 15 minutes, 5 minutes de tampon, moins vos événements existants. Réservable de 12 h à 14 jours à l'avance."
            : "Séances payées de 45, 60 ou 90 minutes (conseil carrière), proposées toutes les 30 minutes dans ces plages, moins vos événements existants. Réservable de 24 h à 5 semaines à l'avance. Ces plages ne servent jamais aux appels de découverte."}
        </p>

        <ul className="mt-4 divide-y divide-slate-100">
          {rules.filter((rule) => rule.kind === kind).map((rule) => (
            <li key={rule.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <strong>{WEEKDAYS[rule.weekday]}</strong> {rule.start} – {rule.end}
              </span>
              <form action={removeAvailabilityRule}>
                <input type="hidden" name="id" value={rule.id} />
                <button className="text-red-700 underline">Retirer</button>
              </form>
            </li>
          ))}
          {rules.filter((rule) => rule.kind === kind).length === 0 && (
            <li className="py-2 text-sm text-red-700">Aucune plage : aucun créneau ne sera proposé{kind === "consulting" ? " pour le conseil" : ""}.</li>
          )}
        </ul>

        <form action={addAvailabilityRule} className="mt-4 grid grid-cols-[1fr_auto_auto_auto] items-end gap-2">
          <input type="hidden" name="kind" value={kind} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Jour</span>
            <select name="weekday" className={input} defaultValue={kind === "consulting" ? "3" : "1"}>
              {WEEKDAYS.map((day, index) => (
                <option key={day} value={index}>{day}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">De</span>
            <input name="start" type="time" defaultValue="18:00" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">À</span>
            <input name="end" type="time" defaultValue="19:00" className={input} />
          </label>
          <button type="submit" className={primary}>Ajouter</button>
        </form>
      </section>
      ))}
    </main>
  );
}

const input = "rounded-lg border border-slate-300 px-3 py-2 text-base";
const primary = "rounded-lg bg-[var(--color-accent)] px-4 py-2.5 font-semibold text-white";
