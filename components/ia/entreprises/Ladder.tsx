"use client";

import { useState } from "react";

import type { Zone } from "@/lib/enterprise";

export type LadderStep = { code: string; name: string; duration: string; items: string[]; featured: boolean; price: Record<Zone, string>; sub: Record<Zone, string> };

/** The five steps, prices in the visitor's zone, switchable. */
export function Ladder({ steps, initialZone }: { steps: LadderStep[]; initialZone: Zone }) {
  const [zone, setZone] = useState<Zone>(initialZone);
  return (
    <>
      <div className="prices-bar">
        <span className="label">Prix affichés pour</span>
        <div className="seg" role="group" aria-label="Zone de prix">
          <button type="button" aria-pressed={zone === "africa"} onClick={() => setZone("africa")}>Afrique francophone</button>
          <button type="button" aria-pressed={zone === "intl"} onClick={() => setZone("intl")}>International</button>
        </div>
      </div>
      <ol className="ladder">
        {steps.map((s) => (
          <li key={s.code} className={"step" + (s.featured ? " key" : "")}>
            {s.featured && <span className="tag">Le plus demandé</span>}
            <h3>{s.name}</h3>
            <ul>{s.items.map((i) => <li key={i}>{i}</li>)}</ul>
            <div className="meta">
              <span className="dur">{s.duration}</span>
              <span className="price">{s.price[zone]}{s.sub[zone] && <small>{s.sub[zone]}</small>}</span>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}
