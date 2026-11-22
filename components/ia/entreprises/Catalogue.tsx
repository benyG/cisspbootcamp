"use client";

import { useState } from "react";

const GROUPS = { all: "Tout", clients: "Clients et ventes", finance: "Finance et administration", ops: "Opérations et équipes", dir: "Direction" } as const;
type Group = keyof typeof GROUPS;

/** What we can automate, by business function (docs: offer proposal, 22/11). */
const ITEMS: Array<{ group: Exclude<Group, "all">; fn: string; level: "auto" | "assist"; text: string; tools: string }> = [
  { group: "clients", fn: "Service client", level: "auto", text: "Un agent WhatsApp et site qui répond depuis vos documents, et passe la main à une personne.", tools: "WhatsApp Business · base documentaire" },
  { group: "clients", fn: "Ventes", level: "assist", text: "Les demandes qualifiées, les relances envoyées à temps, les devis préparés.", tools: "CRM · e-mail · WhatsApp · agenda" },
  { group: "clients", fn: "Marketing", level: "assist", text: "Les publications préparées, programmées, et leurs visites mesurées.", tools: "LinkedIn · réseaux · site" },
  { group: "finance", fn: "Paiements", level: "auto", text: "L’encaissement en ligne, le rapprochement carte et mobile money, les relances d’impayés.", tools: "Stripe · exports mobile money · comptabilité" },
  { group: "finance", fn: "Documents", level: "assist", text: "Factures, contrats et pièces lus et rangés dans votre tableur ou votre logiciel.", tools: "Lecture de documents · tableur · ERP" },
  { group: "finance", fn: "Administration", level: "auto", text: "Pièces comptables classées, échéances rappelées, export du mois pour le comptable.", tools: "Comptabilité · e-mail" },
  { group: "ops", fn: "Connaissance interne", level: "assist", text: "Un assistant qui répond aux équipes depuis vos procédures.", tools: "Google Workspace ou Microsoft 365" },
  { group: "ops", fn: "Opérations", level: "assist", text: "Planning, stock et livraisons suivis, retards signalés avant qu’ils coûtent.", tools: "Tableur · ERP · WhatsApp" },
  { group: "ops", fn: "Ressources humaines", level: "assist", text: "L’accueil des nouveaux et les réponses RH courantes. Jamais de tri de CV automatique.", tools: "Base documentaire" },
  { group: "dir", fn: "Pilotage", level: "auto", text: "Tableau de bord, rapport du lundi, et un analyste qui propose 3 actions chiffrées.", tools: "Vos données, en lecture seule" },
  { group: "dir", fn: "Direction", level: "assist", text: "Claude connecté à vos outils : vous posez vos questions, il prépare des actions que vous validez.", tools: "Claude · connecteurs MCP" },
];

export function Catalogue() {
  const [group, setGroup] = useState<Group>("all");
  return (
    <>
      <div className="fns" role="group" aria-label="Filtrer par fonction">
        {(Object.keys(GROUPS) as Group[]).map((g) => (
          <button key={g} type="button" className="fn" aria-pressed={group === g} onClick={() => setGroup(g)}>{GROUPS[g]}</button>
        ))}
      </div>
      <ul className="cat">
        {ITEMS.filter((i) => group === "all" || i.group === group).map((i) => (
          <li key={i.fn}>
            <div className="top-line"><span className="fn-name">{i.fn}</span><span className={`pill ${i.level}`}>{i.level === "auto" ? "Autonome" : "Assisté"}</span></div>
            <b>{i.text}</b>
            <span className="tools">{i.tools}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
