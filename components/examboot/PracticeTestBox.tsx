"use client";

import { useEffect, useRef, useState } from "react";

import type { Placement } from "@/lib/examboot/service";

type Props = {
  placement: Placement;
  /** Scanner result token: binds the test and its score to the prospect. */
  token?: string;
  /** Booking reschedule token: same, from the call confirmation page. */
  bookingToken?: string;
  title?: string;
  text?: string;
  /** Button label; the default says what happens next. */
  cta?: string;
  dark?: boolean;
  compact?: boolean;
};

type Phase = { kind: "idle" } | { kind: "creating" } | { kind: "waiting"; code: string; shared: boolean } | { kind: "done"; nickname: string | null; percent: number; correct: number; questions: number } | { kind: "gaveup" } | { kind: "error" };

const POLL_MS = 10_000;
const MAX_POLLS = 180;

/**
 * "Testez votre raisonnement CISSP" — docs/CONVERSION.md §8. Creates the
 * test through our own API, opens it in a new tab, then shows the score on
 * this page once ExamBoot has it. A shared (anonymous) test never shows a
 * score: it could be someone else's.
 */
export function PracticeTestBox({ placement, token, bookingToken, title = "Testez votre raisonnement CISSP", text = "Cinq questions d’entraînement, conçues au niveau et dans l’esprit du CISSP, corrigées à la fin. Sans compte, en dix minutes.", cta = "Tester mon niveau — 10 min →", dark = false, compact = false }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const polls = useRef(0);

  // On arrival, pick up where the visitor left off: a score already revealed
  // shows at once; a test still open resumes polling.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (token) params.set("t", token);
    if (bookingToken) params.set("b", bookingToken);
    fetch(`/api/examboot/test/mine?${params}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { status: string; code?: string; nickname?: string | null; percent?: number | null; correct?: number | null; questions?: number; expired?: boolean } | null) => {
        if (cancelled || !data) return;
        if (data.status === "completed" && typeof data.percent === "number") {
          setPhase({ kind: "done", nickname: data.nickname ?? null, percent: data.percent, correct: data.correct ?? 0, questions: data.questions ?? 5 });
        } else if (data.status === "pending" && data.code && !data.expired) {
          polls.current = 0;
          setPhase({ kind: "waiting", code: data.code, shared: false });
        }
      })
      .catch(() => {
        /* the button still works */
      });
    return () => {
      cancelled = true;
    };
  }, [token, bookingToken]);

  useEffect(() => {
    if (phase.kind !== "waiting" || phase.shared) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      polls.current += 1;
      try {
        const res = await fetch(`/api/examboot/test/${encodeURIComponent(phase.code)}`, { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { status: string; nickname: string | null; percent: number | null; correct: number | null; questions: number; expired: boolean };
          if (data.status === "completed" && data.percent !== null) {
            setPhase({ kind: "done", nickname: data.nickname, percent: data.percent, correct: data.correct ?? 0, questions: data.questions });
            return;
          }
          if (data.expired) {
            setPhase({ kind: "gaveup" });
            return;
          }
        }
      } catch {
        /* retry on the next tick */
      }
      if (polls.current < MAX_POLLS && !cancelled) window.setTimeout(tick, POLL_MS);
    };
    const id = window.setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [phase]);

  const start = async () => {
    setPhase({ kind: "creating" });
    // Open the tab synchronously on the click so mobile browsers allow it.
    const tab = window.open("", "_blank");
    try {
      const res = await fetch("/api/examboot/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placement, t: token, b: bookingToken }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { code: string; url: string; shared: boolean };
      if (tab) tab.location.href = data.url;
      else window.open(data.url, "_blank", "noopener");
      polls.current = 0;
      setPhase({ kind: "waiting", code: data.code, shared: data.shared });
    } catch {
      tab?.close();
      setPhase({ kind: "error" });
    }
  };

  const muted = dark ? "text-[#cbd5df]" : "text-muted";
  const box = dark ? "rounded-[18px] bg-ink p-5 text-white" : "rounded-[18px] border border-line bg-white p-5";
  const button = dark
    ? "inline-flex items-center justify-center rounded-[14px] bg-accent-bright px-5 py-3.5 font-extrabold text-ink disabled:opacity-60"
    : "inline-flex items-center justify-center rounded-[14px] bg-ink px-5 py-3.5 font-extrabold text-white disabled:opacity-60";

  return (
    <section className={box} aria-live="polite">
      {!compact && <div className={"text-[.72rem] font-extrabold tracking-[.1em] uppercase " + (dark ? "text-[#7be0c8]" : "text-accent")}>Testez-vous</div>}
      <h3 className={"display font-black " + (compact ? "text-[1.15rem]" : "mt-1 text-[1.4rem] leading-tight")}>{title}</h3>
      {!compact && <p className={"mt-2 text-[.95rem] " + muted}>{text}</p>}

      {phase.kind === "done" ? (
        <div className="mt-4">
          <div className={"display text-[2.4rem] leading-none font-black " + (dark ? "text-white" : "text-ink")}>{phase.percent} %</div>
          <p className={"mt-1 text-[.95rem] " + muted}>
            {phase.correct} bonne{phase.correct > 1 ? "s" : ""} réponse{phase.correct > 1 ? "s" : ""} sur {phase.questions}{phase.nickname ? `, ${phase.nickname}` : ""}.{" "}
            {phase.percent >= 80 ? "Solide. Le bootcamp sert alors à sécuriser la méthode et le rythme jusqu’à l’examen." : phase.percent >= 60 ? "Une base réelle, et des angles morts : exactement ce que le bootcamp travaille." : "C’est le niveau de départ de la plupart des candidats. L’écart se comble en 15 jours de méthode, pas en mois de lecture."}
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" onClick={start} disabled={phase.kind === "creating"} className={button}>
            {phase.kind === "creating" ? "Préparation du test…" : phase.kind === "waiting" ? "Rouvrir le test" : cta}
          </button>
          {phase.kind === "waiting" && !phase.shared && <p className={"text-[.86rem] " + muted}>Le test s’est ouvert dans un nouvel onglet. Votre score s’affichera ici dès que vous l’aurez révélé.</p>}
          {phase.kind === "waiting" && phase.shared && <p className={"text-[.86rem] " + muted}>Le test s’est ouvert dans un nouvel onglet.</p>}
          {phase.kind === "gaveup" && <p className={"text-[.86rem] " + muted}>Le test n’a pas été terminé. Vous pouvez le relancer quand vous voulez.</p>}
          {phase.kind === "error" && <p className="text-[.86rem] text-red-700">Le test n’a pas pu être créé. Réessayez dans un instant.</p>}
        </div>
      )}
    </section>
  );
}
