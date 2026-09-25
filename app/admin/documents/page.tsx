import { FileText } from "lucide-react";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { ATTACHMENT_BUDGET_BYTES, extension, formatBytes } from "@/lib/documents";
import { PROGRAMS } from "@/lib/programs";

import { deleteDocument, toggleDocument } from "./actions";
import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";

/** Library of preparation documents: upload, activate, delete. Sending happens from a lead's sheet. */
export default async function DocumentsPage() {
  const documents = await prisma.document.findMany({ orderBy: [{ program: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, filename: true, size: true, active: true, program: true, createdAt: true } });
  const total = documents.filter((d) => d.active).reduce((sum, d) => sum + d.size, 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><FileText className="size-6 shrink-0 text-accent" aria-hidden />Documents de préparation</h1>
      <p className="mt-1 text-sm text-muted">Les fichiers envoyés avec l&apos;e-mail d&apos;onboarding, 30 Mo maximum par fichier. Jusqu&apos;à {formatBytes(ATTACHMENT_BUDGET_BYTES)} au total, ils partent en pièces jointes ; au-delà, chaque inscrit reçoit un lien de téléchargement personnel dans le même e-mail. L&apos;envoi se déclenche depuis la fiche d&apos;un inscrit, jamais automatiquement. Le texte de l&apos;e-mail se modifie dans les <Link href="/admin/parametres/gabarits" className="underline">gabarits</Link>.</p>

      <UploadForm programs={Object.values(PROGRAMS).map((p) => ({ code: p.code, name: p.name }))} />

      <section className="mt-6 grid gap-2">
        {documents.length === 0 && <p className="text-sm text-muted">Aucun document pour l&apos;instant.</p>}
        {documents.map((d) => (
          <div key={d.id} className={"flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm" + (d.active ? "" : " opacity-60")}>
            <div>
              <p className="font-semibold">{d.name} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-muted">{PROGRAMS[d.program].name}</span>{!d.active && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">désactivé</span>}</p>
              <p className="text-muted">{d.filename} · {extension(d.filename).toUpperCase()} · {formatBytes(d.size)} · ajouté le {d.createdAt.toLocaleDateString("fr-FR")}</p>
            </div>
            <div className="flex gap-2">
              <form action={toggleDocument}><input type="hidden" name="documentId" value={d.id} /><button className={ghost}>{d.active ? "Désactiver" : "Activer"}</button></form>
              <form action={deleteDocument}><input type="hidden" name="documentId" value={d.id} /><button className={ghost}>Supprimer</button></form>
            </div>
          </div>
        ))}
      </section>
      {documents.length > 0 && <p className="mt-3 text-xs text-muted">Documents actifs : {formatBytes(total)} au total.{total > ATTACHMENT_BUDGET_BYTES ? " Une partie partira en liens de téléchargement plutôt qu’en pièces jointes." : ""}</p>}
    </main>
  );
}

const ghost = "rounded-lg border border-line bg-white px-3 py-1.5 font-semibold";
