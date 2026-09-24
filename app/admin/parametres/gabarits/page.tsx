import Link from "next/link";

import { prisma } from "@/lib/db";

import { updateTemplate } from "./actions";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  scanner_result: "Résultat du scanner (e-mail)", booking_confirmation: "Confirmation d'appel", booking_reminder_24h: "Rappel 24 h", booking_reminder_1h: "Rappel 1 h",
  payment_confirmation: "Paiement confirmé", followup_scanner_j2: "Relance J+2 après le scanner", followup_scanner_j7: "Relance J+7 après le scanner",
  followup_after_call_j3: "Relance J+3 après l'appel", unpaid_reminder_j1: "Place non payée, J+1", unpaid_reminder_j3: "Place non payée, J+3", invite_to_book: "Invitation à réserver", onboarding_documents: "Onboarding : documents de préparation (e-mail, pièces jointes)",
};

export default async function TemplatesPage() {
  const templates = await prisma.messageTemplate.findMany({ orderBy: { key: "asc" } });
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <h1 className="mt-3 text-2xl font-bold">Gabarits de messages</h1>
      <p className="mt-1 text-sm text-muted">Marqueurs disponibles : <code>{"{{prenom}}"}</code>, <code>{"{{nom}}"}</code>, <code>{"{{lien_rdv}}"}</code>, <code>{"{{lien_resultat}}"}</code>, <code>{"{{lien_paiement}}"}</code>, <code>{"{{lien_test}}"}</code> (5 questions ExamBoot), <code>{"{{cohorte}}"}</code>, <code>{"{{mois_cohorte}}"}</code>, <code>{"{{liste_documents}}"}</code> (onboarding). Un marqueur inconnu reste visible dans le message : c&apos;est voulu.</p>
      <div className="mt-5 grid gap-3">
        {templates.map((t) => (
          <form key={t.key} action={updateTemplate} className="grid gap-2 rounded-xl border border-line bg-white p-4">
            <input type="hidden" name="key" value={t.key} />
            <p className="font-semibold">{LABELS[t.key] ?? t.key} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-muted">{t.channel}</span></p>
            {t.channel === "email" && <input name="subject" defaultValue={t.subject ?? ""} placeholder="Objet" className={input} />}
            <textarea name="body" rows={t.channel === "email" ? 6 : 3} defaultValue={t.body} className={input} />
            <div className="flex justify-end"><button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Enregistrer</button></div>
          </form>
        ))}
      </div>
    </main>
  );
}
const input = "rounded-lg border border-line px-3 py-2 text-base";
