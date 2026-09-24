import Link from "next/link";

import { prisma } from "@/lib/db";
import { MAX_FILE_BYTES, MAX_TOTAL_BYTES, extension, formatBytes } from "@/lib/documents";
import { PROGRAMS } from "@/lib/programs";

import { deleteDocument, toggleDocument, uploadDocument } from "./actions";

export const dynamic = "force-dynamic";

/** Library of preparation documents: upload, activate, delete. Sending happens from a lead's sheet. */
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const { ok, erreur } = await searchParams;
  const documents = await prisma.document.findMany({ orderBy: [{ program: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, filename: true, size: true, active: true, program: true, createdAt: true } });
  const total = documents.filter((d) => d.active).reduce((sum, d) => sum + d.size, 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <h1 className="mt-3 text-2xl font-bold">Documents de préparation</h1>
      <p className="mt-1 text-sm text-muted">Les fichiers envoyés en pièces jointes de l&apos;e-mail d&apos;onboarding. L&apos;envoi se déclenche depuis la fiche d&apos;un inscrit, jamais automatiquement. Le texte de l&apos;e-mail se modifie dans les <Link href="/admin/parametres/gabarits" className="underline">gabarits</Link>.</p>

      {ok && <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm">Document ajouté.</p>}
      {erreur && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

      <form action={uploadDocument} className="mt-5 grid gap-3 rounded-xl border border-line bg-white p-4">
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Nom affiché dans l&apos;e-mail</span><input name="name" required maxLength={120} placeholder="Programme des 15 jours" className={input} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Formation</span>
            <select name="program" className={input}>{Object.values(PROGRAMS).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Fichier ({formatBytes(MAX_FILE_BYTES)} max)</span><input type="file" name="file" required accept=".pdf,.docx,.pptx,.xlsx,.zip,.png,.jpg,.jpeg" className="text-sm" /></label>
        </div>
        <div className="flex justify-end"><button className="rounded-lg bg-accent px-4 py-2 font-semibold text-white">Ajouter</button></div>
      </form>

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
      {documents.length > 0 && <p className="mt-3 text-xs text-muted">Documents actifs : {formatBytes(total)} au total ; un e-mail accepte {formatBytes(MAX_TOTAL_BYTES)} de pièces jointes.</p>}
    </main>
  );
}

const input = "rounded-lg border border-line px-3 py-2 text-base";
const ghost = "rounded-lg border border-line bg-white px-3 py-1.5 font-semibold";
