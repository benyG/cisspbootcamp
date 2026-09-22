"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { submitScanner, type SubmissionInput } from "@/app/(public)/scanner/actions";
import { formatUsdCents } from "@/lib/pricing";
import { priceLabelFor, type ScannerContext } from "@/lib/scanner/context";
import { COUNTRIES, QUESTIONS, type Question } from "@/lib/scanner/questions";

type Answers = Record<string, string | string[] | boolean | number>;

type Contact = { firstName: string; lastName: string; email: string; whatsapp: string; jobTitle: string; goals: string; consent: boolean };
const EMPTY_CONTACT: Contact = { firstName: "", lastName: "", email: "", whatsapp: "", jobTitle: "", goals: "", consent: false };

type Props = {
  context: Pick<ScannerContext, "tiers" | "availabilityLabel">;
  utm?: SubmissionInput["utm"];
  /** A country already chosen elsewhere on the page (price selector) pre-fills the last screen. */
  initialCountry?: string;
  /** Rendered in the card header. */
  title?: string;
};

/**
 * One question per screen (SPECS A2). Experience opens, country closes — the
 * prototype's assessment card, in the design tokens of app/globals.css.
 * Nothing is written before the prospect has consented; on success the
 * browser goes straight to the result page.
 */
export function ScannerWizard({ context, utm, initialCountry, title = "Analyse de votre profil" }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(initialCountry ? { country: initialCountry } : {});
  const [step, setStep] = useState(0);
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const total = QUESTIONS.length + 1;
  const isCapture = step === QUESTIONS.length;
  const question = isCapture ? null : QUESTIONS[step];

  const priceLabel = useMemo(() => {
    const country = answers.country as string | undefined;
    if (country) return priceLabelFor(country, context.tiers);
    // Country is asked last: until then, name both tiers rather than guess.
    const africa = context.tiers.find((t) => t.code === "africa");
    const intl = context.tiers.find((t) => t.code === "international");
    if (africa && intl) return `${formatUsdCents(africa.amountUsd)} en Afrique francophone, ${formatUsdCents(intl.amountUsd)} ailleurs`;
    return "625 USD en Afrique francophone, 1 200 USD ailleurs";
  }, [answers.country, context.tiers]);

  const label = (q: Question) => q.label.replace("{{price}}", priceLabel).replace("{{availability}}", context.availabilityLabel);

  const advance = () => setStep((s) => s + 1);
  const answerAndAdvance = (id: string, value: Answers[string]) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    // A beat so the selected state is seen before the screen changes.
    window.setTimeout(advance, 160);
  };

  const submit = () => {
    setErrors({});
    startTransition(async () => {
      const result = await submitScanner({ answers: toSubmission(answers), contact: { ...contact, consent: contact.consent as true }, utm });
      if (result.ok) router.push(`/scanner/resultat/${result.resultToken}`);
      else setErrors(result.errors);
    });
  };

  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-[var(--shadow-panel)]">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <strong className="display text-base">{isCapture ? "Où envoyer votre analyse ?" : title}</strong>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 sm:w-48" aria-label={`Étape ${step + 1} sur ${total}`}>
          <div className="h-full rounded-full bg-accent-bright transition-[width] duration-300" style={{ width: `${Math.round(((step + 1) / total) * 100)}%` }} />
        </div>
      </div>

      <div className="px-5 py-6 sm:px-6">
        {question && (
          <section key={question.id} className="flex flex-col gap-4">
            <p className="text-xs font-extrabold tracking-[.08em] text-accent uppercase">Question {step + 1} sur {QUESTIONS.length}</p>
            <h2 className="display text-[1.55rem] leading-[1.18] font-black">{label(question)}</h2>
            {question.hint && <p className="-mt-1 text-[.95rem] text-muted">{question.hint}</p>}

            {question.kind === "country" && (
              <select
                id="scanner-country"
                autoFocus
                value={(answers.country as string | undefined) ?? ""}
                onChange={(e) => e.target.value && answerAndAdvance("country", e.target.value)}
                className={input}
              >
                <option value="">Choisir un pays…</option>
                {COUNTRIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            )}

            {question.kind === "single" && (
              <ul className="grid gap-2.5">
                {question.options.map((option) => {
                  const selected = String(answers[question.id]) === option.value;
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => answerAndAdvance(question.id, question.id === "hasFourYearDegree" ? option.value === "true" : option.value)}
                        className={choice(selected)}
                      >
                        <span className="font-bold">{option.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {question.kind === "scale" && (
              <div className="grid grid-cols-5 gap-2">
                {question.options.map((option) => {
                  const selected = answers[question.id] === Number(option.value);
                  return (
                    <button key={option.value} type="button" aria-pressed={selected} onClick={() => answerAndAdvance(question.id, Number(option.value))} className={choice(selected) + " justify-center py-3.5 text-lg font-extrabold"}>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}

            {question.kind === "multi" && (
              <ul className="grid gap-2">
                {question.options.map((option) => {
                  const list = (answers[question.id] as string[] | undefined) ?? [];
                  const checked = list.includes(option.value);
                  return (
                    <li key={option.value}>
                      <label className={choice(checked) + " cursor-pointer"}>
                        <input
                          type="checkbox"
                          id={`${question.id}-${option.value}`}
                          checked={checked}
                          onChange={() => setAnswers((c) => ({ ...c, [question.id]: checked ? list.filter((v) => v !== option.value) : [...list, option.value] }))}
                          className="size-5 accent-accent"
                        />
                        <span>{option.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-2 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(step - 1)} disabled={step === 0} className="px-1 py-2 font-bold text-muted disabled:invisible">← Retour</button>
              {question.kind === "multi" && (
                <button type="button" onClick={advance} className={primary}>
                  {((answers[question.id] as string[] | undefined) ?? []).length === 0 ? "Aucune, continuer →" : "Continuer →"}
                </button>
              )}
            </div>
          </section>
        )}

        {isCapture && (
          <section className="flex flex-col gap-3">
            <p className="text-xs font-extrabold tracking-[.08em] text-accent uppercase">Dernière étape</p>
            <h2 className="display text-[1.55rem] leading-[1.18] font-black">Votre résultat s&apos;affiche tout de suite.</h2>
            <p className="-mt-1 text-[.95rem] text-muted">Et vous le recevez par e-mail. Ben le lit aussi, et revient vers vous personnellement.</p>

            <div className="grid grid-cols-2 gap-2.5">
              <Field label="Prénom" id="fn" error={errors["contact.firstName"]}><input id="fn" autoComplete="given-name" value={contact.firstName} onChange={(e) => setContact({ ...contact, firstName: e.target.value })} className={input} /></Field>
              <Field label="Nom" id="ln" error={errors["contact.lastName"]}><input id="ln" autoComplete="family-name" value={contact.lastName} onChange={(e) => setContact({ ...contact, lastName: e.target.value })} className={input} /></Field>
            </div>
            <Field label="E-mail" id="em" error={errors["contact.email"]}><input id="em" type="email" inputMode="email" autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className={input} /></Field>
            <Field label="WhatsApp (facultatif)" id="wa" hint="Format international, ex. +221 77 123 45 67" error={errors["contact.whatsapp"]}><input id="wa" type="tel" inputMode="tel" autoComplete="tel" value={contact.whatsapp} onChange={(e) => setContact({ ...contact, whatsapp: e.target.value.replace(/[\s.-]/g, "") })} className={input} /></Field>
            <Field label="Titre de votre poste actuel (facultatif)" id="jt"><input id="jt" autoComplete="organization-title" value={contact.jobTitle} onChange={(e) => setContact({ ...contact, jobTitle: e.target.value })} className={input} /></Field>
            <Field label="Vos objectifs et vos attentes (facultatif)" id="go" hint="Quelques lignes suffisent. Ben les lit avant de vous écrire."><textarea id="go" rows={3} value={contact.goals} onChange={(e) => setContact({ ...contact, goals: e.target.value })} className={input} /></Field>

            <label className="flex items-start gap-3 text-sm text-ink-2">
              <input id="consent" type="checkbox" checked={contact.consent} onChange={(e) => setContact({ ...contact, consent: e.target.checked })} className="mt-1 size-5 shrink-0 accent-accent" />
              <span>
                J&apos;accepte que Ben utilise ces informations pour m&apos;envoyer mon analyse et me recontacter au sujet du bootcamp. Désinscription en un clic dans chaque message.{" "}
                <a href="/confidentialite" className="underline" target="_blank">Politique de confidentialité</a>
              </span>
            </label>
            {errors["contact.consent"] && <p className="text-sm text-red-700">{errors["contact.consent"]}</p>}
            {Object.keys(errors).some((k) => k.startsWith("answers")) && <p className="text-sm text-red-700">Une réponse manque ou est invalide. Revenez en arrière pour vérifier.</p>}

            <div className="mt-2 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(step - 1)} className="px-1 py-2 font-bold text-muted">← Retour</button>
              <button type="button" onClick={submit} disabled={pending} className={primary + " disabled:opacity-60"}>{pending ? "Analyse en cours…" : "Voir mon résultat →"}</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function toSubmission(answers: Answers): SubmissionInput["answers"] {
  return {
    country: String(answers.country ?? ""),
    professionalStatus: answers.professionalStatus as never,
    experience: answers.experience as never,
    domains: (answers.domains as never[]) ?? [],
    hasFourYearDegree: Boolean(answers.hasFourYearDegree),
    certifications: (answers.certifications as never[]) ?? [],
    englishReading: Number(answers.englishReading ?? 0),
    examAttempt: answers.examAttempt as never,
    examGoal: answers.examGoal as never,
    budget: answers.budget as never,
    cohortAvailability: answers.cohortAvailability as never,
  };
}

const input = "w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";
const primary = "ml-auto rounded-xl bg-ink px-4.5 py-3 font-extrabold text-white";
const choice = (on: boolean) =>
  [
    "flex w-full items-start gap-3 rounded-[14px] border px-4 py-3.5 text-left text-base transition-colors",
    on ? "border-accent bg-accent-soft" : "border-line bg-white hover:border-[#a8dccc] hover:bg-[#fbfffd]",
  ].join(" ");

function Field({ label, id, hint, error, children }: { label: string; id: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      {children}
      {hint && !error && <span className="text-xs text-muted">{hint}</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
