"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { approveDiagnosis, setAsideDiagnosis } from "@/app/admin/diagnostics/actions";

export function ReviewForm({ id, initialMessage }: { id: number; initialMessage: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: (data: FormData) => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    const data = new FormData();
    data.set("id", String(id));
    data.set("message", message);
    startTransition(async () => {
      const result = await action(data);
      if (result.ok) router.push("/admin/diagnostics");
      else setError(result.error ?? "Erreur");
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={16}
        className="w-full rounded-lg border border-slate-300 p-3 text-base leading-relaxed outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/30"
      />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(setAsideDiagnosis)}
          className="rounded-lg border border-slate-300 px-4 py-3 font-medium"
        >
          Mettre de côté
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(approveDiagnosis)}
          className="rounded-lg bg-[var(--color-accent)] px-5 py-3 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Envoi…" : "Valider et envoyer"}
        </button>
      </div>
    </div>
  );
}
