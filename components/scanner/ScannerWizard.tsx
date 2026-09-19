"use client";

import Link from "next/link";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { submitScanner, type SubmissionInput } from "@/app/(public)/scanner/actions";
import { priceLabelFor, type ScannerContext } from "@/lib/scanner/context";
import { COUNTRIES, QUESTIONS, type Question } from "@/lib/scanner/questions";

type Answers = Record<string, string | string[] | boolean | number>;

type Contact = {
  firstName: string;
  lastName: string;
  email: string;
  whatsapp: string;
  jobTitle: string;
  goals: string;
  consent: boolean;
};

const EMPTY_CONTACT: Contact = {
  firstName: "",
  lastName: "",
  email: "",
  whatsapp: "",
  jobTitle: "",
  goals: "",
  consent: false,
};

type Props = {
  context: Pick<ScannerContext, "tiers" | "availabilityLabel">;
  utm?: SubmissionInput["utm"];
  /** A country picked on the landing page skips the first screen. */
  initialCountry?: string;
};

/**
 * One question per screen (SPECS A2). State lives here until the final
 * submit; nothing is written before the prospect has consented.
 */
export function ScannerWizard({ context, utm, initialCountry }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>(
    initialCountry ? { country: initialCountry } : {},
  );
  const [step, setStep] = useState(initialCountry ? 1 : 0);
  const [contact, setContact] = useState<Contact>(EMPTY_CONTACT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const total = QUESTIONS.length + 1; // + capture screen
  const isCapture = step === QUESTIONS.length;
  const question = isCapture ? null : QUESTIONS[step];

  const priceLabel = useMemo(
    () => priceLabelFor(answers.country as string | undefined, context.tiers),
    [answers.country, context.tiers],
  );

  const label = (q: Question) =>
    q.label
      .replace("{{price}}", priceLabel)
      .replace("{{availability}}", context.availabilityLabel);

  const answerAndAdvance = (id: string, value: Answers[string]) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    setStep((current) => current + 1);
  };

  const canAdvanceMulti =
    question?.kind === "multi" ? true : Boolean(answers[question?.id ?? ""]);

  const submit = () => {
    setErrors({});
    startTransition(async () => {
      const result = await submitScanner({
        answers: toSubmission(answers),
        contact: { ...contact, consent: contact.consent as true },
        utm,
      });
      if (result.ok) {
        router.push("/scanner/merci");
      } else {
        setErrors(result.errors);
      }
    });
  };

  return (
    <div className="flex min-h-[70vh] flex-col">
      <Progress step={step} total={total} />

      {question && (
        <section key={question.id} className="flex flex-1 flex-col gap-5 py-6">
          <h2 className="text-2xl font-bold leading-tight text-balance">
            {label(question)}
          </h2>
          {question.hint && (
            <p className="text-[var(--color-muted)]">{question.hint}</p>
          )}

          {question.kind === "country" && (
            <CountryPicker
              value={answers.country as string | undefined}
              onPick={(value) => answerAndAdvance("country", value)}
            />
          )}

          {question.kind === "single" && (
            <ul className="flex flex-col gap-3">
              {question.options.map((option) => (
                <li key={option.value}>
                  <ChoiceButton
                    selected={String(answers[question.id]) === option.value}
                    onClick={() =>
                      answerAndAdvance(
                        question.id,
                        question.id === "hasFourYearDegree"
                          ? option.value === "true"
                          : option.value,
                      )
                    }
                  >
                    {option.label}
                  </ChoiceButton>
                </li>
              ))}
            </ul>
          )}

          {question.kind === "scale" && (
            <div className="grid grid-cols-5 gap-2">
              {question.options.map((option) => (
                <ChoiceButton
                  key={option.value}
                  selected={answers[question.id] === Number(option.value)}
                  onClick={() =>
                    answerAndAdvance(question.id, Number(option.value))
                  }
                  compact
                >
                  {option.label}
                </ChoiceButton>
              ))}
            </div>
          )}

          {question.kind === "multi" && (
            <MultiPicker
              options={question.options}
              value={(answers[question.id] as string[] | undefined) ?? []}
              onChange={(value) =>
                setAnswers((current) => ({ ...current, [question.id]: value }))
              }
            />
          )}

          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <BackButton disabled={step === 0} onClick={() => setStep(step - 1)} />
            {question.kind === "multi" && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={!canAdvanceMulti}
                className="rounded-lg bg-[var(--color-accent)] px-5 py-3 font-semibold text-white"
              >
                {((answers[question.id] as string[] | undefined) ?? []).length === 0
                  ? "Aucune, continuer"
                  : "Continuer"}
              </button>
            )}
          </div>
        </section>
      )}

      {isCapture && (
        <section className="flex flex-1 flex-col gap-5 py-6">
          <h2 className="text-2xl font-bold leading-tight">
            Où envoyer votre analyse ?
          </h2>
          <p className="text-[var(--color-muted)]">
            Ben lit chaque profil lui-même. Vous recevez son retour sous 24 heures.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prénom" error={errors["contact.firstName"]}>
              <input
                autoComplete="given-name"
                value={contact.firstName}
                onChange={(e) => setContact({ ...contact, firstName: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Nom" error={errors["contact.lastName"]}>
              <input
                autoComplete="family-name"
                value={contact.lastName}
                onChange={(e) => setContact({ ...contact, lastName: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="E-mail" error={errors["contact.email"]}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={contact.email}
              onChange={(e) => setContact({ ...contact, email: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field
            label="WhatsApp (facultatif)"
            hint="Format international, ex. +221 77 123 45 67"
            error={errors["contact.whatsapp"]}
          >
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={contact.whatsapp}
              onChange={(e) =>
                setContact({ ...contact, whatsapp: e.target.value.replace(/[\s.-]/g, "") })
              }
              className={inputClass}
            />
          </Field>
          <Field label="Titre de votre poste actuel (facultatif)">
            <input
              autoComplete="organization-title"
              value={contact.jobTitle}
              onChange={(e) => setContact({ ...contact, jobTitle: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field
            label="Vos objectifs et vos attentes (facultatif)"
            hint="Quelques lignes suffisent. Ben les lit avant votre appel."
          >
            <textarea
              rows={3}
              value={contact.goals}
              onChange={(e) => setContact({ ...contact, goals: e.target.value })}
              className={inputClass}
            />
          </Field>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={contact.consent}
              onChange={(e) => setContact({ ...contact, consent: e.target.checked })}
              className="mt-1 size-5 shrink-0 accent-[var(--color-accent)]"
            />
            <span>
              J&apos;accepte que Ben utilise ces informations pour m&apos;envoyer mon
              analyse et me recontacter au sujet du bootcamp. Désinscription en un
              clic dans chaque message.{" "}
              <Link href="/confidentialite" className="underline" target="_blank">
                Politique de confidentialité
              </Link>
            </span>
          </label>
          {errors["contact.consent"] && (
            <p className="text-sm text-red-700">{errors["contact.consent"]}</p>
          )}
          {Object.keys(errors).some((key) => key.startsWith("answers")) && (
            <p className="text-sm text-red-700">
              Une réponse manque ou est invalide. Revenez en arrière pour vérifier.
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <BackButton onClick={() => setStep(step - 1)} />
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded-lg bg-[var(--color-accent)] px-5 py-3 font-semibold text-white disabled:opacity-60"
            >
              {pending ? "Envoi…" : "Recevoir mon analyse"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

/** Shapes the wizard's loose state into what the server action validates. */
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

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-3 text-base outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30";

function Progress({ step, total }: { step: number; total: number }) {
  const percent = Math.round(((step + 1) / total) * 100);
  return (
    <div aria-label={`Étape ${step + 1} sur ${total}`}>
      <div className="mb-1 flex justify-between text-xs text-[var(--color-muted)]">
        <span>
          {step + 1} / {total}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ChoiceButton({
  selected,
  onClick,
  compact,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={[
        "w-full rounded-lg border text-left text-base transition-colors",
        compact ? "px-0 py-3 text-center font-semibold" : "px-4 py-3.5",
        selected
          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
          : "border-slate-300 bg-white hover:border-[var(--color-accent)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MultiPicker({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const toggle = (item: string) =>
    onChange(value.includes(item) ? value.filter((v) => v !== item) : [...value, item]);

  return (
    <ul className="flex flex-col gap-2">
      {options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <li key={option.value}>
            <label
              className={[
                "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3",
                checked ? "border-[var(--color-accent)] bg-emerald-50" : "border-slate-300",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(option.value)}
                className="size-5 accent-[var(--color-accent)]"
              />
              <span>{option.label}</span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

function CountryPicker({
  value,
  onPick,
}: {
  value?: string;
  onPick: (value: string) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => e.target.value && onPick(e.target.value)}
      className={inputClass}
      autoFocus
    >
      <option value="">Choisir un pays…</option>
      {COUNTRIES.map((country) => (
        <option key={country.value} value={country.value}>
          {country.label}
        </option>
      ))}
    </select>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-[var(--color-muted)]">{hint}</span>}
      {error && <span className="text-xs text-red-700">{error}</span>}
    </label>
  );
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-2 py-3 text-[var(--color-muted)] disabled:invisible"
    >
      ← Retour
    </button>
  );
}
