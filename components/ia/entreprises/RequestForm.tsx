"use client";

import { useActionState } from "react";

import { type RequestState, submitRequest } from "@/app/(public)/ia/entreprises/actions";
import { FUNCTIONS, SIZES } from "@/lib/enterprise";

type Option = { value: string; label: string };

/** The scoping-call request: two minutes, consent never pre-ticked, then the calendar. */
export function RequestForm({ countries, defaultCountry }: { countries: Option[]; defaultCountry: string }) {
  const [state, action, pending] = useActionState<RequestState, FormData>(submitRequest, {});
  const f = state.fields ?? {};
  return (
    <form className="ent-form" action={action}>
      <div className="two">
        <label>Organisation<input name="organization" autoComplete="organization" placeholder="Ex. : Kofi Distribution" required maxLength={160} defaultValue={f.organization} /></label>
        <label>Pays
          <select name="country" defaultValue={f.country ?? defaultCountry} required>
            <option value="">Choisir…</option>
            {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
      </div>
      <div className="two">
        <label>Votre nom<input name="contactName" autoComplete="name" required maxLength={120} defaultValue={f.contactName} /></label>
        <label>Fonction<input name="jobTitle" autoComplete="organization-title" placeholder="Ex. : directrice générale" maxLength={120} defaultValue={f.jobTitle} /></label>
      </div>
      <div className="two">
        <label>E-mail professionnel<input name="email" type="email" autoComplete="email" required maxLength={180} defaultValue={f.email} /></label>
        <label>Taille
          <select name="size" defaultValue={f.size ?? "10-50"}>
            {Object.entries(SIZES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>Ce que vous voulez traiter en premier</legend>
        <div className="checks">
          {Object.entries(FUNCTIONS).map(([k, v]) => <label key={k}><input type="checkbox" name="functions" value={k} />{v}</label>)}
        </div>
      </fieldset>
      <label className="consent"><input type="checkbox" name="dataOnSite" defaultChecked={f.dataOnSite === "on"} /><span><b>Nos données doivent rester chez nous</b> (IA privée et souveraine, installée dans vos locaux).</span></label>
      <label>Votre besoin en une phrase<textarea name="need" rows={2} maxLength={600} placeholder="Ex. : nos commerciaux passent leurs soirées à répondre sur WhatsApp." defaultValue={f.need} /></label>
      <label className="consent"><input type="checkbox" name="consent" required /><span>J’accepte que l’équipe Bâtisseur IA utilise ces informations pour répondre à ma demande, et seulement pour cela.</span></label>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <button className="btn btn-go btn-big" type="submit" disabled={pending}>{pending ? "Un instant…" : "Choisir un créneau"}</button>
    </form>
  );
}
