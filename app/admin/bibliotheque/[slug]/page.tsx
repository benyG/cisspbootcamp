import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PrintButton } from "@/components/library/PrintButton";
import { LIBRARY_CATEGORIES, formatUpdated, getLibraryDoc, renderMarkdown } from "@/lib/library";

import "@/components/library/markdown.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = getLibraryDoc((await params).slug);
  return { title: doc ? `${doc.title} · Bibliothèque` : "Bibliothèque", robots: { index: false, follow: false } };
}

/** One document of the library, to read or print as a PDF. */
export default async function LibraryDocPage({ params }: { params: Promise<{ slug: string }> }) {
  const doc = getLibraryDoc((await params).slug);
  if (!doc) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/admin/bibliotheque" className="text-sm text-muted">← Bibliothèque</Link>
        <PrintButton />
      </div>
      <p className="mt-4 text-xs font-bold tracking-[.06em] text-muted uppercase">{LIBRARY_CATEGORIES[doc.category]}</p>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight">{doc.title}</h1>
      <p className="mt-1 text-sm text-muted">Mis à jour le {formatUpdated(doc.updated)}</p>
      {doc.audience === "participants" && <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink print:hidden">À remettre aux participants : lien public <a href="/ia/fiches" className="font-semibold underline">/ia/fiches</a>, ou le PDF de cette page.</p>}
      <article className="md-doc mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.body) }} />
    </main>
  );
}
