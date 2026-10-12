"use client";

import { useState, useTransition } from "react";

import { requestReopenAction } from "@/app/(public)/replays/[token]/actions";

/** An expired participant asks Ben to reopen the replays (Ben, 12/10). */
export function RequestAccess({ token, alreadyAsked }: { token: string; alreadyAsked: boolean }) {
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(alreadyAsked ? { ok: true, text: "Votre demande est envoyée : Ben vous répond par e-mail." } : null);
  const [pending, run] = useTransition();
  if (result?.ok) return <p className="rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent-ink"><b>Demande envoyée.</b> {result.text.replace(/^Demande envoyée\.\s*/, "") || "Ben vous répond par e-mail ; si l’accès est rouvert, ce lien refonctionne tel quel."}</p>;
  return (
    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run(async () => { const r = await requestReopenAction({ token, note }); setResult(r.ok ? { ok: true, text: "Ben vous répond par e-mail ; si l’accès est rouvert, ce lien refonctionne tel quel." } : { ok: false, text: r.error }); }); }}>
      <label htmlFor="note" className="text-sm font-medium">Votre message à Ben</label>
      <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} required placeholder="Par exemple : mon examen est reporté au 15 mars, j’aimerais revoir les domaines 3 et 4." className="rounded-xl border border-line px-3 py-2 text-base" />
      <div><button disabled={pending} className="rounded-xl bg-accent px-4 py-2.5 font-bold text-white disabled:opacity-50">{pending ? "Envoi…" : "Redemander l’accès"}</button></div>
      {result && !result.ok && <p className="text-sm text-red-800">{result.text}</p>}
    </form>
  );
}
