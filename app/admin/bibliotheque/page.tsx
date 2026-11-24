import { Download, FileText, Library, Presentation } from "lucide-react";
import Link from "next/link";

import { UploadForm } from "@/app/admin/documents/UploadForm";
import { deleteDocument } from "@/app/admin/documents/actions";
import { prisma } from "@/lib/db";
import { INTERNAL, extension, formatBytes } from "@/lib/documents";
import { LIBRARY_CATEGORIES, type LibraryCategory, formatUpdated, listLibrary } from "@/lib/library";
import { PROGRAMS } from "@/lib/programs";

export const dynamic = "force-dynamic";

/**
 * The library (Ben, 24/11): every document written for the business, kept by
 * the application and always up to date, and the files Ben brings (slides,
 * trainer files). Nothing here is sent to anyone.
 */
export default async function LibraryPage() {
  const docs = listLibrary();
  const files = await prisma.document.findMany({ where: { audience: INTERNAL }, orderBy: [{ program: "asc" }, { createdAt: "asc" }], select: { id: true, name: true, filename: true, size: true, program: true, createdAt: true } });
  const categories = (Object.keys(LIBRARY_CATEGORIES) as LibraryCategory[]).filter((c) => docs.some((d) => d.category === c));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Library className="size-6 shrink-0 text-accent" aria-hidden />Bibliothèque</h1>
      <p className="mt-1 text-sm text-muted">Les documents de l&apos;entreprise, toujours à jour : chaque correction est faite ici. Ouvrez-en un pour le lire ou l&apos;enregistrer en PDF. Les documents envoyés aux inscrits restent dans <Link href="/admin/documents" className="underline">Documents de préparation</Link>.</p>

      {categories.map((c) => (
        <section key={c} className="mt-6">
          <h2 className="mb-2 text-sm font-extrabold tracking-[.06em] text-muted uppercase">{LIBRARY_CATEGORIES[c]}</h2>
          <ul className="grid gap-2">
            {docs.filter((d) => d.category === c).map((d) => (
              <li key={d.slug} className="rounded-xl border border-line bg-white hover:border-ink">
                <Link href={`/admin/bibliotheque/${d.slug}`} className="block px-4 py-3">
                  <span className="flex items-start gap-2 font-semibold"><FileText className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />{d.title}</span>
                  {d.summary && <span className="mt-1 block text-sm text-muted">{d.summary}</span>}
                  <span className="mt-1 block text-xs text-muted">Mis à jour le {formatUpdated(d.updated)}{d.audience === "participants" ? " · à remettre aux participants" : ""}</span>
                </Link>
                {d.deck && (
                  <a href={`/admin/bibliotheque/presentation/${d.deck}`} className="mx-4 mb-3 inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-semibold"><Presentation className="size-4" aria-hidden />Présentation PowerPoint, avec les notes</a>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="mt-8">
        <h2 className="mb-1 text-sm font-extrabold tracking-[.06em] text-muted uppercase">Vos fichiers : diapositives, fichiers du formateur</h2>
        <p className="text-sm text-muted">PowerPoint, Word, Excel, PDF, ZIP ou images, {formatBytes(30 * 1024 * 1024)} par fichier. Gardés en stockage privé, jamais envoyés aux participants.</p>
        <UploadForm programs={Object.values(PROGRAMS).map((p) => ({ code: p.code, name: p.name }))} audience="internal" />
        <div className="mt-4 grid gap-2">
          {files.length === 0 && <p className="text-sm text-muted">Aucun fichier pour l&apos;instant.</p>}
          {files.map((f) => (
            <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-semibold">{f.name} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-muted">{PROGRAMS[f.program].name}</span></p>
                <p className="truncate text-muted">{f.filename} · {extension(f.filename).toUpperCase()} · {formatBytes(f.size)} · ajouté le {f.createdAt.toLocaleDateString("fr-FR")}</p>
              </div>
              <div className="flex gap-2">
                <a href={`/admin/bibliotheque/fichier/${f.id}`} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold"><Download className="size-4" aria-hidden />Télécharger</a>
                <form action={deleteDocument}><input type="hidden" name="documentId" value={f.id} /><button className="rounded-lg border border-line bg-white px-3 py-1.5 font-semibold">Supprimer</button></form>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
