"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import type { CheckResult, Status } from "@/lib/health/checks";

const LABEL: Record<Status, string> = { ok: "OK", warn: "À surveiller", fail: "En panne", off: "Non branché" };
const STYLE: Record<Status, string> = {
  ok: "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]",
  warn: "bg-amber-50 text-amber-800",
  fail: "bg-red-50 text-red-800",
  off: "bg-slate-100 text-muted",
};
const ORDER: Record<Status, number> = { fail: 0, warn: 1, off: 2, ok: 3 };
const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** One click tests every integration; problems first, each with what to do. */
export function HealthPanel({ run, testEmail }: { run: () => Promise<{ at: string; results: CheckResult[] }>; testEmail: () => Promise<{ ok: boolean; message: string }> }) {
  const [data, setData] = useState<{ at: string; results: CheckResult[] } | null>(null);
  const [mail, setMail] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const [sending, startMail] = useTransition();

  const results = data ? [...data.results].sort((a, b) => ORDER[a.status] - ORDER[b.status]) : [];
  const count = (s: Status) => results.filter((r) => r.status === s).length;

  return (
    <div className="mt-5 grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} onClick={() => start(async () => setData(await run()))} className="rounded-lg bg-[var(--color-accent)] px-5 py-3 font-semibold text-white disabled:opacity-60">
          {pending ? "Test en cours…" : data ? "Tout retester" : "Tout tester"}
        </button>
        <button type="button" disabled={sending} onClick={() => startMail(async () => setMail(await testEmail()))} className="rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold disabled:opacity-60">
          {sending ? "Envoi…" : "M’envoyer un e-mail de test"}
        </button>
        {data && <span className="text-xs text-muted">Testé à {time.format(new Date(data.at))}</span>}
      </div>
      {mail && <p className={"rounded-lg px-3 py-2 text-sm " + (mail.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800")}>{mail.message}</p>}

      {data && (
        <p className="rounded-xl border border-line bg-white px-4 py-3 text-sm" role="status">
          {count("fail") ? <b className="text-red-800">{count("fail")} en panne</b> : <b className="text-[var(--color-accent-ink)]">Aucune panne</b>}
          {` · ${count("warn")} à surveiller · ${count("ok")} OK · ${count("off")} non branché${count("off") > 1 ? "s" : ""}`}
        </p>
      )}

      {data && (
        <ul className="grid gap-2.5">
          {results.map((r) => (
            <li key={r.id} className={"grid gap-2 rounded-xl border bg-white p-4 " + (r.status === "fail" ? "border-red-200" : r.status === "warn" ? "border-amber-200" : "border-line")}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0"><b>{r.name}</b><span className="block text-xs text-muted">{r.role}</span></span>
                <span className={"shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold " + STYLE[r.status]}>{LABEL[r.status]}</span>
              </div>
              <p className="text-sm text-ink-2">{r.detail}</p>
              {r.fix && r.status !== "ok" && (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">Pour corriger</span>
                  <ol className="mt-1 grid list-decimal gap-1 pl-5">{r.fix.map((f) => <li key={f}>{f}</li>)}</ol>
                </div>
              )}
              {r.href && r.status !== "ok" && <Link href={r.href} className="text-sm font-semibold underline">Ouvrir le réglage</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
