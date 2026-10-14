"use client";

import { useState, useTransition } from "react";

import { resendAction } from "@/app/admin/evaluations/actions";

export function ResendButton({ recipientId }: { recipientId: number }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await resendAction({ recipientId }); setNote(r.ok ? "Renvoyé" : r.error); })} className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-semibold disabled:opacity-50">
        {pending ? "…" : "Renvoyer"}
      </button>
      {note && <span className="text-xs text-muted">{note}</span>}
    </span>
  );
}
