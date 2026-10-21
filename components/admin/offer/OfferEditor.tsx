"use client";

import { Printer, Save } from "lucide-react";
import { useState, useTransition } from "react";

import { saveOfferAction } from "@/app/admin/devis/actions";
import { type Offer, FORMATS, PROGRAM_TITLES, defaultSchedule, offerLines, usd } from "@/lib/offer";

import { type OfferContext, OfferDocument } from "./OfferDocument";

const field = "w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm";
const label = "grid gap-1 text-xs font-semibold";

/** Edit on the left, the A4 document on the right, print to PDF (Ben, 21/10). */
export function OfferEditor({ initial, ctx, quoteId }: { initial: Offer; ctx: OfferContext; quoteId: number | null }) {
  const [o, setO] = useState<Offer>(initial);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof Offer>(k: K, v: Offer[K]) => setO((prev) => ({ ...prev, [k]: v }));
  const text = (k: keyof Offer, l: string, rows = 0) => (
    <label className={label}>{l}
      {rows ? <textarea rows={rows} value={String(o[k])} onChange={(e) => set(k, e.target.value as never)} className={field} />
        : <input value={String(o[k])} onChange={(e) => set(k, e.target.value as never)} className={field} />}
    </label>
  );
  const num = (k: keyof Offer, l: string) => (
    <label className={label}>{l}<input type="number" min={0} value={Number(o[k])} onChange={(e) => set(k, (Number(e.target.value) || 0) as never)} className={field + " tabular-nums"} /></label>
  );
  const { totalUsd } = offerLines(o);

  function save(markSent: boolean) {
    if (!quoteId) return;
    start(async () => {
      const r = await saveOfferAction({ quoteId, offer: o, markSent });
      setNote(r.ok ? (markSent ? "Offre enregistrée, demande marquée « Devis envoyé »." : "Offre enregistrée.") : r.error);
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
      <style>{`@page { size: A4; margin: 12mm } @media print { body * { visibility: hidden } #offer-doc, #offer-doc * { visibility: visible } #offer-doc { position: absolute; inset: 0 auto auto 0; width: 100% } }`}</style>
      <form onSubmit={(e) => e.preventDefault()} className="grid content-start gap-3 rounded-xl border border-line bg-white p-4 print:hidden xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
        <div className="grid grid-cols-2 gap-2">{text("reference", "Référence")}<label className={label}>Date<input type="date" value={o.issuedOn} onChange={(e) => e.target.value && set("issuedOn", e.target.value)} className={field} /></label></div>
        {num("validDays", "Validité (jours)")}
        <fieldset className="grid gap-2 border-t border-line pt-3"><legend className="text-xs font-bold text-muted uppercase">Destinataire</legend>
          {text("organization", "Entreprise")}
          <div className="grid grid-cols-2 gap-2">{text("contactName", "Contact")}{text("jobTitle", "Fonction")}</div>
          <div className="grid grid-cols-2 gap-2">{text("country", "Pays")}{text("email", "E-mail")}</div>
        </fieldset>
        <fieldset className="grid gap-2 border-t border-line pt-3"><legend className="text-xs font-bold text-muted uppercase">Formation</legend>
          <label className={label}>Programme
            <select value={o.program} onChange={(e) => { const p = e.target.value as Offer["program"]; setO((prev) => ({ ...prev, program: p, schedule: prev.schedule === defaultSchedule(prev.program) ? defaultSchedule(p) : prev.schedule })); }} className={field}>
              {Object.entries(PROGRAM_TITLES).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select></label>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Format<select value={o.format} onChange={(e) => set("format", e.target.value as Offer["format"])} className={field}>{Object.entries(FORMATS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
            {num("participants", "Participants")}
          </div>
          {o.format !== "online" && text("location", "Lieu (ville, locaux)")}
          {text("schedule", "Calendrier", 3)}
          {text("objectives", "Votre besoin (vide = section masquée)", 3)}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={o.includeReplays} onChange={(e) => set("includeReplays", e.target.checked)} />Inclure l&apos;accès aux enregistrements</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={o.includeEvaluations} onChange={(e) => set("includeEvaluations", e.target.checked)} />Inclure les tests et examens blancs ExamBoot</label>
        </fieldset>
        <fieldset className="grid gap-2 border-t border-line pt-3"><legend className="text-xs font-bold text-muted uppercase">Prix (USD par participant)</legend>
          <div className="grid grid-cols-2 gap-2">
            {o.program !== "cc" && num("priceUsd", "CISSP")}
            {o.program !== "cissp" && num("ccPriceUsd", "CC")}
          </div>
          <p className="text-sm">Total : <b className="tabular-nums">{totalUsd ? usd(totalUsd) : "à préciser"}</b></p>
          {text("paymentTerms", "Conditions de paiement", 2)}
          {text("extraTerms", "Conditions particulières (facultatif)", 2)}
        </fieldset>
        <div className="flex flex-wrap gap-2 border-t border-line pt-3">
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white"><Printer className="size-4" aria-hidden />Imprimer ou PDF</button>
          {quoteId && <button type="button" disabled={pending} onClick={() => save(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-semibold"><Save className="size-4" aria-hidden />Enregistrer</button>}
          {quoteId && <button type="button" disabled={pending} onClick={() => save(true)} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold">Enregistrer et marquer envoyé</button>}
        </div>
        {note && <p className="text-sm text-muted">{note}</p>}
        <p className="text-xs text-muted">Dans la fenêtre d&apos;impression, choisissez « Enregistrer au format PDF ».</p>
      </form>
      <div className="min-w-0 overflow-x-auto rounded-xl bg-paper p-2 print:overflow-visible print:bg-white print:p-0"><OfferDocument offer={o} ctx={ctx} /></div>
    </div>
  );
}
