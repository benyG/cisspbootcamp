"use client";

import { useState } from "react";

import { type Hosting, HOSTINGS, type Zone } from "@/lib/enterprise";

import { useZone } from "./zone";

/** Where the data goes in each mode (Ben, 24/11): the arrow to the provider disappears on site. */
const MODES: Record<Hosting, { flow: [boolean, boolean]; out: string; text: string; fit: string }> = {
  cloud: { flow: [true, true], out: "Réduites au nécessaire, transfert déclaré", text: "Les meilleurs modèles hébergés, sur vos comptes, avec un plafond de dépense.", fit: "PME, service client, ventes, pilotage" },
  hybrid: { flow: [true, false], out: "Aucune donnée sensible", text: "Un modèle installé chez vous pour le sensible ; les modèles hébergés pour le reste.", fit: "Cabinets, finance, ressources humaines" },
  onsite: { flow: [false, false], out: "Aucune", text: "Un modèle ouvert sur votre serveur, dans votre réseau. Il fonctionne même sans internet.", fit: "Santé, banque, assurance, administration" },
};

export function HostingModes() {
  const [mode, setMode] = useState<Hosting>("onsite");
  const m = MODES[mode];
  return (
    <div className="modes">
      <div className="seg" role="group" aria-label="Mode d’hébergement">
        {(Object.keys(HOSTINGS) as Hosting[]).map((h) => <button key={h} type="button" aria-pressed={mode === h} onClick={() => setMode(h)}>{HOSTINGS[h]}</button>)}
      </div>
      <div className="flow" aria-label={`Données qui sortent : ${m.out}`}>
        <span className="node home">Vos locaux<small>{mode === "cloud" ? "vos outils" : "modèle + vos documents"}</small></span>
        <span className={"link" + (m.flow[0] ? "" : " cut")} aria-hidden>{m.flow[0] ? (mode === "hybrid" ? "le reste →" : "→") : "×"}</span>
        <span className={"node" + (m.flow[0] ? "" : " off")}>Internet</span>
        <span className={"link" + (m.flow[0] ? "" : " cut")} aria-hidden>{m.flow[0] ? "→" : "×"}</span>
        <span className={"node" + (m.flow[0] ? "" : " off")}>Fournisseur d’IA</span>
      </div>
      <dl className="mode-facts">
        <div><dt>Données qui sortent</dt><dd>{m.out}</dd></div>
        <div><dt>Comment</dt><dd>{m.text}</dd></div>
        <div><dt>Pour qui</dt><dd>{m.fit}</dd></div>
      </dl>
    </div>
  );
}

export type SovereignCard = { code: string; name: string; duration: string; items: string[]; outcome: string; price: Record<Zone, string> };

/** The three sovereign offers, in the page's price zone. */
export function SovereignOffers({ cards }: { cards: SovereignCard[] }) {
  const { zone } = useZone();
  return (
    <ol className="sov-offers">
      {cards.map((c) => (
        <li key={c.code}>
          <h3>{c.name}</h3>
          <ul>{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
          <p className="out">→ {c.outcome}</p>
          <div className="meta"><span className="dur">{c.duration}</span><span className="price">{c.price[zone]}</span></div>
        </li>
      ))}
    </ol>
  );
}
