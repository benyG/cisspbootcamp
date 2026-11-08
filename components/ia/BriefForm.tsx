"use client";

import { useState, useTransition } from "react";

import { saveBriefAction } from "@/app/(public)/ia/calendrier/[token]/actions";
import { BRIEF_FIELDS, type Brief, PAYMENTS } from "@/lib/ia-brief";

const field = "w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base font-normal";

/** The project sheet (Ben, 04/11): filled before J1, editable until then. */
export function BriefForm({ token, initial, savedAt }: { token: string; initial: Brief | null; savedAt: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [open, setOpen] = useState(!initial);
  const [pending, start] = useTransition();

  function submit(form: HTMLFormElement) {
    const d = new FormData(form);
    const brief = { ...Object.fromEntries(BRIEF_FIELDS.map((f) => [f.key, String(d.get(f.key) ?? "")])), payments: String(d.get("payments") ?? "") };
    setError(null);
    setDone(null);
    start(async () => {
      try {
        const result = await saveBriefAction({ token, brief });
        if (result.ok) { setDone(result.message); setOpen(false); } else setError(result.error);
      } catch {
        setError("La connexion a échoué. Vérifiez votre réseau et réessayez.");
      }
    });
  }

  return (
    <section className="rounded-[18px] border border-line bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-extrabold">Ma fiche projet</h2>
        {(initial || done) && <span className="rounded bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-ink">{done ? "envoyée" : `envoyée le ${savedAt ? new Date(savedAt).toLocaleDateString("fr-FR") : ""}`}</span>}
      </div>
      <p className="mt-1 text-[.9rem] text-muted">L’équipe la lit avant la J1 : vous démarrez directement sur votre projet.</p>
      {done && <p role="status" className="mt-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[.92rem] text-accent-ink">{done}</p>}
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 text-[.92rem] font-bold underline underline-offset-4">Modifier ma fiche</button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="mt-3 grid gap-3.5" noValidate>
          {BRIEF_FIELDS.map((f) => (
            <label key={f.key} className="grid gap-1 text-[.9rem] font-bold">
              {f.label}
              <span className="text-[.8rem] font-normal text-muted">{f.hint}</span>
              {f.rows > 1 ? (
                <textarea name={f.key} rows={f.rows} maxLength={f.max} defaultValue={initial?.[f.key] ?? ""} className={field} />
              ) : (
                <input name={f.key} maxLength={f.max} defaultValue={initial?.[f.key] ?? ""} className={field} />
              )}
            </label>
          ))}
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[.9rem] font-bold">Encaisser en ligne avec votre système ?</legend>
            {Object.entries(PAYMENTS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5 text-[.92rem] has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
                <input type="radio" name="payments" value={value} defaultChecked={initial?.payments === value} className="size-4 accent-accent" />{label}
              </label>
            ))}
          </fieldset>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[.92rem] text-red-800">{error}</p>}
          <button disabled={pending} className="rounded-[14px] bg-ink px-5 py-3.5 font-extrabold text-white disabled:opacity-60">{pending ? "Envoi…" : initial ? "Mettre à jour ma fiche" : "Envoyer ma fiche"}</button>
        </form>
      )}
    </section>
  );
}
