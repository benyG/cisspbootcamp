"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The hero's illustration (Ben, 08/11, from the validated prototype): the
 * autopilot of a small business on a Tuesday morning. The night's work
 * arrives line by line, the curve draws, what is public waits for a yes.
 * An illustration of what each participant builds at J6, said under it.
 * Everything is shown at rest; the loop only replays it.
 */
const NIGHT: ReadonlyArray<{ at: string; text: string; wait?: boolean }> = [
  { at: "02 h", text: "✓ 2 relances de devis envoyées" },
  { at: "04 h", text: "✓ 1 acompte reçu, facture envoyée" },
  { at: "05 h", text: "✓ Rapport de la semaine prêt" },
  { at: "06 h", text: "● 3 publications écrites, à relire", wait: true },
];
const LOOP_MS = 9000;
const LINE_MS = 1100;

export function AutopilotConsole() {
  const [shown, setShown] = useState(NIGHT.length);
  const [run, setRun] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const play = () => {
      timers.current.forEach(window.clearTimeout);
      setShown(0);
      setRun((r) => r + 1);
      timers.current = NIGHT.map((_, k) => window.setTimeout(() => setShown(k + 1), 900 + k * LINE_MS));
    };
    const start = window.setTimeout(play, 1200);
    const loop = window.setInterval(play, LOOP_MS);
    return () => { window.clearTimeout(start); window.clearInterval(loop); timers.current.forEach(window.clearTimeout); };
  }, []);

  const count = shown >= 3 ? 13 : shown >= 2 ? 12 : 11;
  return (
    <div className="live-zone">
      <div className="autopilot" aria-label="Exemple : le pilote automatique d’une entreprise, un mardi matin">
        <div className="ap-bar"><b>Pilote automatique</b><span>mardi, 7 h</span></div>
        <div className="ap-body">
          <div className="ap-goal">
            <div className="ap-goal-head"><span>Objectif · 20 commandes</span><b>{count} · en avance</b></div>
            <svg viewBox="0 0 300 92" role="img" aria-label="Courbe cible et commandes du mois">
              <line x1="8" y1="84" x2="292" y2="84" stroke="#1E3550" strokeWidth="1" />
              <polyline points="8,84 100,66 200,40 292,10" fill="none" stroke="#2F6FB5" strokeWidth="2.5" strokeDasharray="5 4" />
              <polyline key={run} className={run ? "ap-line run" : "ap-line"} points="8,84 40,80 80,68 120,58 150,50 180,38" fill="none" stroke="#17B890" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="180" cy="38" r="4.5" fill="#17B890" />
            </svg>
          </div>
          <ul className="ap-night">
            {NIGHT.map((l, k) => (
              <li key={l.at} className={k < shown ? undefined : "off"}><time>{l.at}</time><span className={l.wait ? "wait" : "ok"}>{l.text}</span></li>
            ))}
          </ul>
          <div className="ap-valid">Rien de public ne part sans vous <span key={shown >= NIGHT.length ? `on-${run}` : "off"} className={shown >= NIGHT.length && run ? "fresh" : undefined}>3 À VALIDER</span></div>
        </div>
      </div>
      <p className="note">Illustration : ce que chacun construit à la J6.</p>
    </div>
  );
}
