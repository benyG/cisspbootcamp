"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * The programme (Ben, 05/11): pick a journée, see what you write to Claude
 * Code, what you know afterwards, and an example project on a phone where
 * what is still on the plan is blue and what is built is white. Tours the
 * journées until the reader takes over.
 */
export type ScrubDay = { n: number; title: string; text: string; short: string; prompt: string; skills: readonly string[] };

const PARTS: ReadonlyArray<{ day: number; plan: string; className?: string; content: ReactNode }> = [
  { day: 1, plan: "J1 · mise en ligne", className: "url", content: <><span>atelier-adjoa.com</span><span className="live">en ligne</span></> },
  { day: 1, plan: "J1 · page d’accueil", content: <><div className="shop">Atelier Adjoa<small>Couture sur mesure · Lomé</small></div><span className="mini-btn">Prendre rendez-vous pour mes mesures</span></> },
  { day: 2, plan: "J2 · clientes et tableau de bord", content: <><div className="rows"><div><span>Afi K. · robe de cérémonie</span><span className="pill ok">prête</span></div><div><span>Kossi A. · 3 chemises</span><span className="pill">mesures</span></div></div><div className="bars" aria-hidden="true">{[35, 52, 44, 70, 62, 88].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div></> },
  { day: 3, plan: "J3 · paiement et factures", content: <><div className="rows"><div><b>Acompte · 15 000 FCFA</b><span className="pill ok">F-0042.pdf</span></div></div><div className="pay"><span className="om">Orange Money</span><span className="mtn">MTN MoMo</span><span>Carte</span></div></> },
  { day: 4, plan: "J4 · publications", className: "social", content: <><span className="thumb" aria-hidden="true" /><span><b>LinkedIn · Facebook</b>« Nouveaux modèles en wax pour les fêtes » · image prête, à valider</span></> },
  { day: 5, plan: "J5 · référencement", content: <div className="rows"><div><b>couture sur mesure Lomé</b><span className="pill ok">mot-clé suivi</span></div><div><span>3 sujets à publier ce mois</span><span className="pill">plan de contenu</span></div></div> },
  { day: 6, plan: "J6 · votre agent IA", className: "agent", content: <><b>Analyse du lundi, via MCP</b>4 clientes à relancer ; les ensembles en pagne se vendent le mieux ce mois. À valider avant envoi.</> },
];

export function BuildScrubber({ days }: { days: readonly ScrubDay[] }) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(days[0]?.prompt.length ?? 0);
  const touring = useRef(true);
  const still = useRef(false);
  const day = days[index];

  useEffect(() => {
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still.current) return;
    const timer = window.setInterval(() => { if (touring.current) setIndex((i) => (i + 1) % days.length); }, 5200);
    return () => window.clearInterval(timer);
  }, [days.length]);

  // Types the journée's prompt, as in the terminal.
  useEffect(() => {
    if (still.current) { setTyped(day.prompt.length); return; }
    setTyped(0);
    const timer = window.setInterval(() => setTyped((n) => { if (n >= day.prompt.length) { window.clearInterval(timer); return n; } return n + 1; }), 22);
    return () => window.clearInterval(timer);
  }, [day.prompt]);

  const pick = (i: number) => { touring.current = false; setIndex(i); };

  return (
    <>
      <div className="days" role="tablist" aria-label={`Les ${days.length} journées`}>
        {days.map((d, i) => (
          <button key={d.n} type="button" role="tab" id={`journee-${d.n}`} aria-selected={i === index} aria-controls="journee-panel" className={"day" + (i < index ? " done" : "")} onClick={() => pick(i)}>
            <b>J{d.n}</b><span>{d.short}</span>
          </button>
        ))}
      </div>
      <div className="progress" aria-hidden="true"><i style={{ width: `${((index + 1) / days.length) * 100}%` }} /></div>

      <div className="build" onPointerDown={() => { touring.current = false; }}>
        <div className="day-copy" role="tabpanel" id="journee-panel" aria-labelledby={`journee-${day.n}`}>
          <span className="label">Journée {day.n} sur {days.length}</span>
          <h3>{day.title}</h3>
          <p>{day.text}</p>
          <span className="label" style={{ display: "block", marginTop: 18 }}>Ce que vous écrivez à Claude Code</span>
          <div className="prompt" style={{ marginTop: 8 }}>
            <span className="who">vous ›</span> {day.prompt.slice(0, typed)}<span className="caret" aria-hidden="true" />
          </div>
          <span className="label" style={{ display: "block", marginTop: 18 }}>Vous savez désormais</span>
          <ul className="delivered" style={{ marginTop: 8 }}>{day.skills.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="example-tag">Atelier Adjoa : projet d’exemple. Les étapes sont celles du programme.</p>
        </div>

        <div className="phone" aria-label={`Le projet d’exemple à la fin de la journée ${day.n}`}>
          <div className="screen">
            {PARTS.map((p, i) => {
              const built = p.day <= day.n;
              return (
                <div key={i} className={"part" + (p.className ? ` ${p.className}` : "") + (built && p.day === day.n ? " fresh" : "")} data-state={built ? "built" : "plan"} data-plan={p.plan}>
                  {p.content}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
