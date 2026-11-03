"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { submitIaDiagnosticAction } from "@/app/(public)/ia/diagnostic/actions";
import { rememberUtm } from "@/lib/tracking/client";
import { ACTIVITIES, EASE, HOURS, type IaAnswers, TASKS, TOOLS } from "@/lib/ia-diagnostic";
import { track } from "@/lib/tracking/client";

type Option = { value: string; label: string };
type Step = { id: keyof IaAnswers; q: string; hint?: string; multi?: boolean; options: Record<string, string> | Record<string, { label: string }> };

const STEPS: Step[] = [
  { id: "activity", q: "Quelle est votre activité ?", options: ACTIVITIES },
  { id: "tasks", q: "Qu’est-ce qui vous prend le plus de temps ?", hint: "Plusieurs réponses possibles", multi: true, options: TASKS },
  { id: "hours", q: "Combien d’heures par semaine y passez-vous ?", options: HOURS },
  { id: "tools", q: "Avec quoi travaillez-vous aujourd’hui ?", options: TOOLS },
  { id: "ease", q: "Installer un logiciel, créer un compte, retrouver un fichier : votre aisance ?", options: EASE },
];

const labelOf = (v: string | { label: string }) => (typeof v === "string" ? v : v.label);
const field = "w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base";
const label = "grid gap-1.5 text-[.9rem] font-bold";

/** The Bâtisseur IA automation diagnostic (Ben, 03/11): five questions, then the contact step. */
export function Diagnostic({ countries }: { countries: Option[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<IaAnswers>>({ tasks: [] });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const total = STEPS.length;

  function choose(id: keyof IaAnswers, value: string) {
    if (step === 0) track("ia_diagnostic_start");
    setAnswers((a) => ({ ...a, [id]: value }));
    setStep((s) => s + 1);
  }

  function toggle(value: string) {
    setAnswers((a) => {
      const tasks = (a.tasks ?? []) as string[];
      return { ...a, tasks: (tasks.includes(value) ? tasks.filter((t) => t !== value) : [...tasks, value]) as IaAnswers["tasks"] };
    });
  }

  function submit(form: HTMLFormElement) {
    const d = new FormData(form);
    const get = (k: string) => String(d.get(k) ?? "");
    setError(null);
    start(async () => {
      try {
        const result = await submitIaDiagnosticAction({
          answers,
          contact: { firstName: get("firstName"), email: get("email"), country: get("country"), whatsapp: get("whatsapp"), consent: d.get("consent") === "on", website: get("website") },
          utm: rememberUtm(),
        });
        if (result.ok) router.push(`/ia/diagnostic/resultat/${result.token}`);
        else setError(result.error);
      } catch {
        setError("La connexion a échoué. Vérifiez votre réseau et réessayez.");
      }
    });
  }

  const back = step > 0 && (
    <button type="button" onClick={() => setStep((s) => s - 1)} className="text-[.92rem] font-bold text-muted underline underline-offset-4">Retour</button>
  );

  if (step < total) {
    const s = STEPS[step];
    const tasks = (answers.tasks ?? []) as string[];
    return (
      <div className="grid gap-4 rounded-[22px] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6">
        <p className="text-[.8rem] font-extrabold tracking-[.08em] text-accent uppercase">Question {step + 1} sur {total}</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-accent transition-all" style={{ width: `${(step / total) * 100}%` }} /></div>
        <h2 className="display text-[1.35rem] leading-tight font-black">{s.q}</h2>
        {s.hint && <p className="-mt-2 text-[.9rem] text-muted">{s.hint}</p>}
        <div className="grid gap-2">
          {Object.entries(s.options).map(([value, text]) =>
            s.multi ? (
              <label key={value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3.5 py-3 font-bold has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink">
                <input type="checkbox" checked={tasks.includes(value)} onChange={() => toggle(value)} className="size-4 shrink-0" />{labelOf(text)}
              </label>
            ) : (
              <button key={value} type="button" onClick={() => choose(s.id, value)} aria-pressed={answers[s.id] === value} className={`rounded-xl border px-3.5 py-3 text-left font-bold ${answers[s.id] === value ? "border-accent bg-accent-soft text-accent-ink" : "border-line bg-white"}`}>{labelOf(text)}</button>
            ),
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          {back || <span />}
          {s.multi && <button type="button" disabled={tasks.length === 0} onClick={() => setStep((x) => x + 1)} className="rounded-[14px] bg-ink px-5 py-3 font-extrabold text-white disabled:opacity-50">Continuer</button>}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="grid gap-4 rounded-[22px] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6" noValidate>
      <h2 className="display text-[1.35rem] leading-tight font-black">Où vous envoyer le résultat ?</h2>
      <p className="-mt-2 text-[.92rem] text-muted">Vous le voyez tout de suite à l’écran, et vous le recevez par e-mail.</p>
      <label className={label}>Prénom<input name="firstName" required maxLength={80} autoComplete="given-name" className={field} /></label>
      <label className={label}>E-mail<input name="email" type="email" required maxLength={180} autoComplete="email" className={field} /></label>
      <label className={label}>Pays
        <select name="country" required defaultValue="" className={field}>
          <option value="" disabled>Choisir</option>
          {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </label>
      <label className={label}>WhatsApp <span className="font-normal text-muted">(facultatif, format international)</span><input name="whatsapp" type="tel" maxLength={32} autoComplete="tel" placeholder="+225…" className={field} /></label>
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" />
      <label className="flex items-start gap-2.5 text-[.88rem] text-ink-2">
        <input type="checkbox" name="consent" className="mt-1 size-4 shrink-0" />
        J&apos;accepte que Ben m&apos;envoie ce résultat et me recontacte au sujet du Bâtisseur IA. Désinscription en un clic dans chaque e-mail.
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[.92rem] text-red-800">{error}</p>}
      <button disabled={pending} className="inline-flex items-center justify-center rounded-[14px] bg-ink px-5.5 py-4 font-extrabold text-white disabled:opacity-60">{pending ? "Calcul…" : "Voir mon résultat"}</button>
      {back}
    </form>
  );
}
