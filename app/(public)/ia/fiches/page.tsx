import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { PrintButton } from "@/components/library/PrintButton";
import { formatUpdated, getLibraryDoc, renderMarkdown } from "@/lib/library";

import "../landing.css";
import "@/components/library/markdown.css";

export const metadata: Metadata = { title: "Fiches réflexes · Bâtisseur IA", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The participants' five sheets (Ben, 24/11), from the library: one link to send before J1, printable. */
export default function FichesPage() {
  const doc = getLibraryDoc("fiches-reflexes-batisseur-ia");
  if (!doc || doc.audience !== "participants") notFound();
  return (
    <>
      <div className="ial print:hidden"><IaTopbar /></div>
      <main className="mx-auto w-full max-w-3xl px-5 py-8 print:max-w-none print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold tracking-[.06em] text-muted uppercase">Formation Bâtisseur IA · participants</p>
          <PrintButton label="Enregistrer en PDF" />
        </div>
        <h1 className="mt-2 text-2xl font-extrabold leading-tight">{doc.title}</h1>
        <p className="mt-1 text-sm text-muted">Mis à jour le {formatUpdated(doc.updated)}</p>
        <article className="md-doc mt-6" dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.body) }} />
      </main>
      <div className="ial print:hidden"><IaFooter /></div>
    </>
  );
}
