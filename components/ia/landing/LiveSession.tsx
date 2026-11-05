"use client";

import { useEffect, useState } from "react";

/**
 * The hero's illustration (Ben, 05/11): a live bootcamp day. The trainer's
 * screen types the day's step in Claude Code; the participants, each on
 * their own project, turn green when they have done it. Fictitious people,
 * said under the picture.
 */
const LINES: ReadonlyArray<{ kind: "who" | "out" | "ok"; prefix: string; text: string }> = [
  { kind: "who", prefix: "ben › ", text: "Ajoute un acompte par Orange Money ou carte sur la page de commande." },
  { kind: "out", prefix: "", text: "Claude Code : page de paiement créée, 3 tests ajoutés." },
  { kind: "ok", prefix: "", text: "✓ tests réussis · en ligne" },
  { kind: "who", prefix: "ben › ", text: "À vous : même étape sur votre projet. Je passe voir chacun." },
];

const TILES: ReadonlyArray<{ initials: string; name: string; project: string; status: string; done?: boolean; flips?: boolean; coach?: boolean }> = [
  { initials: "B", name: "Ben", project: "formateur", status: "montre l’étape", done: true, coach: true },
  { initials: "AK", name: "Adjoa", project: "atelier de couture", status: "✓ paiement en ligne", done: true },
  { initials: "MN", name: "Moussa", project: "cabinet comptable", status: "en cours…", flips: true },
  { initials: "FD", name: "Fatou", project: "salon de coiffure", status: "✓ rendez-vous", done: true },
  { initials: "JE", name: "Jean", project: "transport de colis", status: "en cours…", flips: true },
  { initials: "+7", name: "7 autres", project: "chacun son projet", status: "au travail" },
];

export function LiveSession({ journee }: { journee: { n: number; title: string } }) {
  // Number of characters shown, over all lines; everything is shown at rest.
  const total = LINES.reduce((n, l) => n + l.text.length, 0);
  const [shown, setShown] = useState(total);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let n = 0;
    let pause = 0;
    setShown(0);
    setFlipped(false);
    const timer = window.setInterval(() => {
      if (pause > 0) {
        pause--;
        if (pause === 0) { n = 0; setShown(0); setFlipped(false); }
        return;
      }
      n++;
      setShown(n);
      if (n >= total) { setFlipped(true); pause = 160; }
    }, 26);
    return () => window.clearInterval(timer);
  }, [total]);

  let left = shown;
  return (
    <div className="live-zone">
      <div className="session" aria-label="Une journée du bootcamp, en direct">
        <div className="s-bar"><span className="rec">En direct · J{journee.n}</span><span>{journee.title} · 12 participants</span></div>
        <div className="s-main">
          <div className="share">
            <div className="share-head"><span>Écran partagé : <b>Ben</b></span><span>Claude Code</span></div>
            <div className="term">
              {LINES.map((l, i) => {
                const n = Math.max(0, Math.min(l.text.length, left));
                left -= l.text.length;
                if (n === 0 && i > 0) return null;
                return (
                  <div key={i}>
                    {l.prefix && <span className="who">{l.prefix}</span>}
                    {l.kind === "who" ? l.text.slice(0, n) : <span className={l.kind}>{l.text.slice(0, n)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="tiles" aria-label="Chacun construit son propre projet">
            {TILES.map((t) => {
              const ok = t.done || (t.flips && flipped);
              return (
                <div key={t.name} className={"tile" + (t.coach ? " coach" : "")}>
                  <span className="who"><span className="av">{t.initials}</span>{t.name}</span>
                  <span className="proj">{t.project}</span>
                  <span className={"st" + (ok ? " ok" : "")}>{t.flips && flipped ? "✓ paiement en ligne" : t.status}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="note">Illustration d’une journée : participants et projets fictifs.</p>
    </div>
  );
}
