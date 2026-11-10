"use client";

import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";

import { EXAMPLES, type ExampleKey } from "@/lib/ia-landing";

/**
 * The programme (Ben, 05/11; two examples 08/11): pick a journée, see what
 * you ask the AI, what you know afterwards, and an example project
 * on a phone where what is still on the plan is blue and what runs is white.
 * Tours J1 to J6 for Adjoa (an existing workshop), then for Kofi (a business
 * that starts), and again, until the reader takes over.
 */
export type ScrubDay = { n: number; title: string; text: string; short: string; skills: readonly string[] };

type Part = { day: number; plan: string; className?: string; content: ReactNode };

const bars = (heights: number[]) => <div className="bars" aria-hidden="true">{heights.map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>;
const PLAN = ["J1 · assistant sur vos documents", "J2 · mise en ligne", "J2 · page d’accueil", "J3 · clients et chiffres", "J4 · agents : paiements et relances", "J5 · agent communication", "J5 · agent de veille", "J6 · pilotage autonome"];
const DAY_OF = [1, 2, 2, 3, 4, 5, 5, 6];
const CLASS_OF: Array<string | undefined> = [undefined, "url", undefined, undefined, undefined, "social", undefined, "pilot"];

const CONTENT: Record<ExampleKey, ReactNode[]> = {
  adjoa: [
    <div key="a1" className="rows"><div><b>« Délai pour une robe ? »</b><span className="pill ok">répondu</span></div><div><span>D’après tarifs-atelier.pdf</span><span className="pill">source</span></div></div>,
    <Fragment key="k0"><span>atelier-adjoa.com</span><span className="live">en ligne</span></Fragment>,
    <Fragment key="k1"><div className="shop">Atelier Adjoa<small>Couture sur mesure · Lomé</small></div><span className="mini-btn">Prendre rendez-vous</span></Fragment>,
    <Fragment key="k2"><div className="rows"><div><span>Afi K. · robe de cérémonie</span><span className="pill ok">prête</span></div><div><span>Kossi A. · 3 chemises</span><span className="pill">mesures</span></div></div>{bars([35, 52, 44, 70, 62, 88])}</Fragment>,
    <Fragment key="k3"><div className="rows"><div><b>Acompte · 15 000 FCFA</b><span className="pill ok">F-0042.pdf</span></div><div><span>Devis D-118 relancé</span><span className="pill ok">auto</span></div></div><div className="pay"><span className="om">Orange Money</span><span className="mtn">MTN MoMo</span><span>Carte</span></div></Fragment>,
    <Fragment key="k4"><span className="thumb" aria-hidden="true" /><span><b>LinkedIn · Facebook</b>« Nouveaux modèles en wax » · à valider</span></Fragment>,
    <div key="k5" className="rows"><div><b>couture sur mesure Lomé</b><span className="pill ok">suivi</span></div><div><span>3 sujets ce mois</span><span className="pill">plan</span></div></div>,
    <Fragment key="k6"><div className="ph"><span>Objectif · 20 commandes</span><b>13 · en avance</b></div><div className="meter"><i style={{ width: "65%" }} /></div><div className="pl"><span>✓ 4 relances préparées</span><span className="w">● 3 à valider</span></div></Fragment>,
  ],
  kofi: [
    <div key="a2" className="rows"><div><b>« Prix pour 40 repas ? »</b><span className="pill ok">répondu</span></div><div><span>D’après menus-entreprise.pdf</span><span className="pill">source</span></div></div>,
    <Fragment key="k7"><span>kofi-traiteur.ci</span><span className="live">en ligne</span></Fragment>,
    <Fragment key="k8"><div className="shop">Kofi Traiteur<small>Repas d’entreprise · Abidjan</small></div><span className="mini-btn">Demander un devis</span></Fragment>,
    <Fragment key="k9"><div className="rows"><div><span>Cabinet Kouassi · 40 repas</span><span className="pill ok">confirmé</span></div><div><span>Courses de jeudi</span><span className="pill">liste prête</span></div></div>{bars([20, 30, 45, 40, 60, 72])}</Fragment>,
    <Fragment key="k10"><div className="rows"><div><b>Acompte · 120 000 FCFA</b><span className="pill ok">D-007.pdf</span></div><div><span>Relance agence Yao</span><span className="pill ok">auto</span></div></div><div className="pay"><span className="om">Orange Money</span><span className="mtn">MTN MoMo</span><span>Carte</span></div></Fragment>,
    <Fragment key="k11"><span className="thumb" aria-hidden="true" /><span><b>LinkedIn</b>« Le menu de la semaine » · à valider</span></Fragment>,
    <div key="k12" className="rows"><div><b>traiteur entreprise Abidjan</b><span className="pill ok">suivi</span></div><div><span>3 concurrents suivis</span><span className="pill">plan</span></div></div>,
    <Fragment key="k13"><div className="ph"><span>Objectif · 8 contrats</span><b className="late">3 · en retard</b></div><div className="meter"><i className="late" style={{ width: "38%" }} /></div><div className="pl"><span>✓ Plan de rattrapage prêt</span><span className="w">● attend votre accord</span></div></Fragment>,
  ],
};

const parts = (who: ExampleKey): Part[] => CONTENT[who].map((content, i) => ({ day: DAY_OF[i]!, plan: PLAN[i]!, className: CLASS_OF[i], content }));
const ORDER: ExampleKey[] = ["adjoa", "kofi"];

export function BuildScrubber({ days }: { days: readonly ScrubDay[] }) {
  const [{ who, index }, setStep] = useState<{ who: ExampleKey; index: number }>({ who: "adjoa", index: 0 });
  const prompt = EXAMPLES[who].prompts[index] ?? "";
  const [typed, setTyped] = useState(prompt.length);
  const touring = useRef(true);
  const still = useRef(false);
  const day = days[index]!;

  // J1 to J6 for one example, then the other, and again.
  useEffect(() => {
    still.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still.current) return;
    const timer = window.setInterval(() => {
      if (!touring.current) return;
      setStep((s) => (s.index < days.length - 1 ? { ...s, index: s.index + 1 } : { who: ORDER[(ORDER.indexOf(s.who) + 1) % ORDER.length]!, index: 0 }));
    }, 5200);
    return () => window.clearInterval(timer);
  }, [days.length]);

  // Types the journée's prompt, as in the terminal.
  useEffect(() => {
    if (still.current) { setTyped(prompt.length); return; }
    setTyped(0);
    const timer = window.setInterval(() => setTyped((n) => { if (n >= prompt.length) { window.clearInterval(timer); return n; } return n + 1; }), 22);
    return () => window.clearInterval(timer);
  }, [prompt]);

  const pick = (i: number) => { touring.current = false; setStep((s) => ({ ...s, index: i })); };
  // Picking an example starts its tour from J1; the tour goes on by itself.
  const choose = (k: ExampleKey) => { setStep({ who: k, index: 0 }); touring.current = !still.current; };

  return (
    <>
      <div className="examples" role="group" aria-label="Le projet d’exemple">
        {ORDER.map((k) => <button key={k} type="button" aria-pressed={who === k} onClick={() => choose(k)}>{EXAMPLES[k].tab}</button>)}
      </div>
      <div className="days" role="tablist" aria-label={`Les ${days.length} journées`}>
        {days.map((d, i) => (
          <button key={d.n} type="button" role="tab" id={`journee-${d.n}`} aria-selected={i === index} aria-controls="journee-panel" className={"day" + (i < index ? " done" : "") + (d.n === days.length ? " last" : "")} onClick={() => pick(i)}>
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
          <span className="label" style={{ display: "block", marginTop: 18 }}>Ce que vous demandez à l’IA</span>
          <div className="prompt" style={{ marginTop: 8 }}>
            <span className="who">vous ›</span> {prompt.slice(0, typed)}<span className="caret" aria-hidden="true" />
          </div>
          <span className="label" style={{ display: "block", marginTop: 18 }}>Vous savez désormais</span>
          <ul className="delivered" style={{ marginTop: 8 }}>{day.skills.map((s) => <li key={s}>{s}</li>)}</ul>
          <p className="example-tag">{EXAMPLES[who].note} Les étapes sont celles du programme.</p>
        </div>

        <div className="phone" aria-label={`Le projet d’exemple à la fin de la journée ${day.n}`}>
          <div className="screen">
            {parts(who).map((p, i) => {
              const built = p.day <= day.n;
              return (
                <div key={`${who}-${i}`} className={"part" + (p.className ? ` ${p.className}` : "") + (built && p.day === day.n ? " fresh" : "")} data-state={built ? "built" : "plan"} data-plan={p.plan}>
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
