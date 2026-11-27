import { Compass } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { examBootEnabled } from "@/lib/examboot/client";
import { activePillars, loadEditorial } from "@/lib/marketing/editorial";
import { type MarketingKind, destinationsFor } from "@/lib/marketing/plan";

import { resetEditorialLine, saveEditorialLine } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ligne éditoriale · Marketing", robots: { index: false, follow: false } };

const AUDIENCES: Record<MarketingKind, string> = { cert: "CISSP et CC", ia: "Bâtisseur IA" };

/**
 * The editorial line (Ben, 27/11): what every topic idea and every post is
 * anchored on. One form per audience; the model reads it before anything else.
 */
export default async function EditorialLinePage({ searchParams }: { searchParams: Promise<{ public?: string; ok?: string; erreur?: string }> }) {
  const { public: pub, ok, erreur } = await searchParams;
  const kind: MarketingKind = pub === "ia" ? "ia" : "cert";
  const line = await loadEditorial(kind);
  const shares = Object.fromEntries(activePillars(line).map((p) => [p.key, p.share]));
  const destinations = Object.entries(destinationsFor(kind)).filter(([k]) => k !== "test" || examBootEnabled());

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin/marketing" className="text-sm text-muted">← Marketing</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Compass className="size-6 shrink-0 text-accent" aria-hidden />Ligne éditoriale</h1>
      <p className="mt-1 text-sm text-muted">Ce sur quoi s&apos;appuient toutes les idées de sujets et tous les posts proposés : les piliers et leur part, le public, vos convictions, le ton, ce qu&apos;il faut éviter, et des posts modèles. Le modèle lit cette page avant tout le reste.</p>

      <nav className="mt-4 flex flex-wrap gap-2 text-sm">
        {(Object.keys(AUDIENCES) as MarketingKind[]).map((k) => (
          <Link key={k} href={`/admin/marketing/ligne-editoriale?public=${k}`} className={"rounded-full border px-3 py-1 font-semibold " + (k === kind ? "border-ink bg-ink text-white" : "border-line bg-white")}>{AUDIENCES[k]}</Link>
        ))}
      </nav>

      {ok && <p className="mt-4 rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-ink">Enregistré : les prochaines idées et les prochains posts suivent cette ligne.</p>}
      {erreur && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{erreur}</p>}

      <form action={saveEditorialLine} className="mt-5 grid gap-6">
        <input type="hidden" name="kind" value={kind} />

        <section>
          <h2 className={h2}>Les piliers</h2>
          <p className="mt-1 text-sm text-muted">La part est relative : 30 et 10 veulent dire trois fois plus de posts sur le premier. Mettez 0 pour ne plus proposer un pilier. Un exemple de sujet par ligne.</p>
          <div className="mt-3 grid gap-3">
            {Object.entries(line.pillars).map(([k, p]) => (
              <fieldset key={k} className="rounded-xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-0 flex-1 text-sm font-semibold">Nom<input name={`${k}.label`} defaultValue={p.label} required maxLength={60} className={input} /></label>
                  <label className="w-24 text-sm font-semibold">Part<input name={`${k}.weight`} type="number" min={0} max={100} defaultValue={p.weight} className={input} /></label>
                  <span className="pb-2 text-sm text-muted">{shares[k] ? `${shares[k]} % des posts` : "désactivé"}</span>
                </div>
                <label className="mt-3 block text-sm font-semibold">Intention : ce que ces posts doivent faire<textarea name={`${k}.intent`} defaultValue={p.intent} rows={2} maxLength={400} className={input} /></label>
                <label className="mt-3 block text-sm font-semibold">Exemples de sujets<textarea name={`${k}.examples`} defaultValue={p.examples.join("\n")} rows={3} className={input} /></label>
                <label className="mt-3 block text-sm font-semibold">Le lien du post mène à
                  <select name={`${k}.destination`} defaultValue={p.destination} className={input}>
                    {destinations.map(([value, d]) => <option key={value} value={value}>{d.label}</option>)}
                  </select>
                </label>
              </fieldset>
            ))}
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className={h2}>Le cadre</h2>
          <label className="block text-sm font-semibold">Public visé<textarea name="audience" defaultValue={line.audience} rows={3} maxLength={1200} className={input} /></label>
          <label className="block text-sm font-semibold">Vos convictions, que chaque post doit refléter<textarea name="convictions" defaultValue={line.convictions} rows={5} maxLength={2000} className={input} /></label>
          <label className="block text-sm font-semibold">Le ton<textarea name="tone" defaultValue={line.tone} rows={3} maxLength={1200} className={input} /></label>
          <label className="block text-sm font-semibold">À éviter absolument<textarea name="avoid" defaultValue={line.avoid} rows={5} maxLength={2000} className={input} /></label>
          <label className="block text-sm font-semibold">Posts modèles, que le modèle imite pour le ton et le niveau (sans les recopier)<textarea name="models" defaultValue={line.models} rows={10} maxLength={4000} className={input} /></label>
        </section>

        <div className="sticky bottom-0 flex flex-wrap gap-2 border-t border-line bg-white/95 py-3">
          <button className="rounded-lg bg-ink px-4 py-2 font-semibold text-white">Enregistrer</button>
        </div>
      </form>

      <form action={resetEditorialLine} className="mt-2">
        <input type="hidden" name="kind" value={kind} />
        <button className="text-sm text-muted underline">Revenir aux valeurs proposées le 27/11</button>
      </form>
    </main>
  );
}

const h2 = "text-xs font-extrabold tracking-[.06em] text-muted uppercase";
const input = "mt-1 block w-full rounded-lg border border-line bg-white px-3 py-2 font-normal";
