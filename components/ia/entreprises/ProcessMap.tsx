"use client";

import { useState } from "react";

const LABEL = { manual: "Manuel", assist: "Assisté", auto: "Autonome" } as const;
type Level = keyof typeof LABEL;

/** An example company's processes, before and after three months (the page's signature). */
const ROWS: Array<{ name: string; detail: string; before: Level; after: Level }> = [
  { name: "Questions des clients", detail: "WhatsApp, téléphone, e-mail", before: "manual", after: "auto" },
  { name: "Devis et relances", detail: "Prospects qui ne répondent pas", before: "manual", after: "assist" },
  { name: "Factures fournisseurs", detail: "Saisie dans le tableur", before: "manual", after: "assist" },
  { name: "Paiements reçus", detail: "Carte, virement, mobile money", before: "assist", after: "auto" },
  { name: "Chiffres du mois", detail: "Ventes, impayés, stock", before: "manual", after: "auto" },
  { name: "Prix et remises", detail: "Décision de la direction", before: "manual", after: "manual" },
];

export function ProcessMap() {
  const [when, setWhen] = useState<"before" | "after">("before");
  return (
    <div className="map" aria-label="Exemple de carte des processus">
      <div className="map-head">
        <span className="label">Exemple · PME de distribution, 40 personnes</span>
        <div className="seg" role="group" aria-label="Moment">
          <button type="button" aria-pressed={when === "before"} onClick={() => setWhen("before")}>Avant</button>
          <button type="button" aria-pressed={when === "after"} onClick={() => setWhen("after")}>Après 3 mois</button>
        </div>
      </div>
      <ul>
        {ROWS.map((r) => (
          <li key={r.name} className="row">
            <span><b>{r.name}</b><small>{r.detail}</small></span>
            <span className={`pill ${r[when]}`}>{LABEL[r[when]]}</span>
          </li>
        ))}
      </ul>
      <p className="map-foot">{when === "before" ? "Aujourd’hui : presque tout passe par une personne." : "Après 3 mois : les prix restent à la direction ; le reste tourne seul ou avec validation."}</p>
    </div>
  );
}
