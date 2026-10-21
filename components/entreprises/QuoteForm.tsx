"use client";

import { useState, useTransition } from "react";

import { submitQuoteAction } from "@/app/(public)/entreprises/actions";
import { track } from "@/lib/tracking/client";
import { ANSWER_DELAY, CERTIFICATIONS, FORMATS, HEADCOUNTS, TIMINGS } from "@/lib/quotes-options";

type Option = { value: string; label: string };

const field = "w-full rounded-xl border border-line bg-white px-3.5 py-3 text-base";
const label = "grid gap-1.5 text-[.9rem] font-bold";

/** The company quote form (Ben, 21/10): mobile first, consent never pre-checked. */
export function QuoteForm({ countries }: { countries: Option[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [sent, setSent] = useState(false);

  function submit(form: HTMLFormElement) {
    const d = new FormData(form);
    const get = (k: string) => String(d.get(k) ?? "");
    setError(null);
    start(async () => {
      const r = await submitQuoteAction({
        organization: get("organization"), country: get("country"), contactName: get("contactName"), jobTitle: get("jobTitle"),
        email: get("email"), phone: get("phone"), certification: get("certification"), format: get("format"), headcount: get("headcount"),
        timing: get("timing"), need: get("need"), consent: d.get("consent") === "on", website: get("website"),
      });
      if (!r.ok) {
        setError({ message: r.error, field: r.field });
        if (r.field) form.querySelector<HTMLElement>(`[name="${r.field}"]`)?.focus();
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div role="status" className="grid gap-2 rounded-[22px] border border-accent bg-accent-soft p-6 text-accent-ink">
        <b className="display text-[1.4rem] font-black">Demande envoyée.</b>
        <p>Ben vous répond sous {ANSWER_DELAY} à l&apos;adresse indiquée. Un e-mail de confirmation vient de partir.</p>
      </div>
    );
  }

  const radios = (name: string, options: Record<string, string>, initial: string) => (
    <div className="flex flex-wrap gap-2">
      {Object.entries(options).map(([value, text]) => (
        <label key={value} className="cursor-pointer rounded-xl border border-line bg-white px-3.5 py-2.5 text-[.92rem] font-bold has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-bright">
          <input type="radio" name={name} value={value} defaultChecked={value === initial} className="sr-only" />{text}
        </label>
      ))}
    </div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(e.currentTarget); }} className="grid gap-4 rounded-[22px] border border-line bg-white p-5 shadow-[var(--shadow-card)] sm:p-6" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Entreprise ou organisation<input name="organization" required maxLength={160} autoComplete="organization" className={field} /></label>
        <label className={label}>Pays
          <select name="country" defaultValue="" required className={field}><option value="" disabled>Choisir…</option>{countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label className={label}>Votre nom<input name="contactName" required maxLength={120} autoComplete="name" className={field} /></label>
        <label className={label}>Fonction <span className="font-normal text-muted">(facultatif)</span><input name="jobTitle" maxLength={120} autoComplete="organization-title" className={field} /></label>
        <label className={label}>E-mail professionnel<input name="email" type="email" required maxLength={180} autoComplete="email" className={field} /></label>
        <label className={label}>Téléphone ou WhatsApp <span className="font-normal text-muted">(facultatif)</span><input name="phone" type="tel" maxLength={40} autoComplete="tel" placeholder="+225 …" className={field} /></label>
      </div>
      <fieldset className="grid gap-2"><legend className="mb-1.5 text-[.9rem] font-bold">Formation</legend>{radios("certification", CERTIFICATIONS, "cissp")}</fieldset>
      <fieldset className="grid gap-2"><legend className="mb-1.5 text-[.9rem] font-bold">Format</legend>{radios("format", FORMATS, "online")}</fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={label}>Nombre de personnes<select name="headcount" defaultValue="6-10" className={field}>{Object.entries(HEADCOUNTS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label className={label}>Période souhaitée<select name="timing" defaultValue="6m" className={field}>{Object.entries(TIMINGS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      </div>
      <label className={label}>Votre besoin <span className="font-normal text-muted">(facultatif : objectifs, contraintes, lieu si sur site)</span><textarea name="need" rows={4} maxLength={2000} className={field} /></label>
      {/* Honeypot: hidden from people and screen readers. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] size-px opacity-0" />
      <label className="flex items-start gap-2.5 text-[.88rem] text-ink-2">
        <input type="checkbox" name="consent" className="mt-1 size-4 shrink-0" />
        J&apos;accepte que CISSP Bootcamp utilise ces informations pour répondre à ma demande. Elles ne sont ni revendues ni utilisées pour autre chose.
      </label>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[.92rem] text-red-800">{error.message}</p>}
      <button disabled={pending} onClick={() => track("cta_click", { label: "quote-submit" })} className="inline-flex items-center justify-center rounded-[14px] bg-ink px-5.5 py-4 font-extrabold text-white disabled:opacity-60">
        {pending ? "Envoi…" : "Demander un devis"}
      </button>
      <p className="text-[.84rem] text-muted">Pas de prix affiché : chaque devis dépend du nombre de personnes, du format et du lieu.</p>
    </form>
  );
}
