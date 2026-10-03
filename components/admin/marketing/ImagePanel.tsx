"use client";

import { Download, ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { type ImageRow, generateVisual } from "@/app/admin/marketing/actions";

/**
 * Brand visuals of a post (Ben, 03/10). Ben describes the scene; MiniMax
 * draws the photograph within the brand's rules; the app adds the headline,
 * the green word and the signature. Prefilled from the post's visual brief.
 */
export function ImagePanel({ postId, size, defaults, initial }: { postId: number; size: string; defaults: { scene: string; headline: string; keyword: string }; initial: ImageRow[] }) {
  const router = useRouter();
  const [scene, setScene] = useState(defaults.scene);
  const [headline, setHeadline] = useState(defaults.headline);
  const [keyword, setKeyword] = useState(defaults.keyword);
  const [images, setImages] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();

  return (
    <details className="mt-2 w-full rounded-lg bg-slate-50 p-3 text-sm" open={images.length > 0}>
      <summary className="flex cursor-pointer items-center gap-1.5 font-semibold"><ImageIcon className="size-4" aria-hidden />Visuel MiniMax{images.length ? ` · ${images.length}` : ""}</summary>
      <label className="mt-2 flex flex-col gap-1">Scène de la photo (qui, quoi, où ; l&apos;anglais donne les meilleurs résultats)
        <textarea value={scene} onChange={(e) => setScene(e.target.value)} rows={3} maxLength={650} className="rounded-lg border border-line px-3 py-2 text-xs" /></label>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_12rem]">
        <label className="flex flex-col gap-1">Titre sur l&apos;image (5 à 8 mots, vide = sans titre)
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={70} className="rounded-lg border border-line px-3 py-2 text-base" /></label>
        <label className="flex flex-col gap-1">Mot en vert
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} maxLength={60} className="rounded-lg border border-line px-3 py-2 text-base" /></label>
      </div>
      <p className="mt-1 text-xs text-muted">Charte appliquée d&apos;office : photo réaliste (professionnels africains de la cyber, lieu de travail crédible), bleu nuit et une touche de vert, aucun cliché de hacker ; titre en Inter Tight, un mot en vert, ligne des 15 points, signature « CISSP Bootcamp ». Format {size}. Personnes fictives : ne les présentez jamais comme vous, un élève ou un témoignage. Un clic = une image facturée par MiniMax.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={() => run(async () => { setError(null); const r = await generateVisual({ postId, scene, headline, keyword }); if (r.ok) { setImages(r.images); router.refresh(); } else setError(r.error); })} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white">
          <ImageIcon className="size-4" aria-hidden />{pending ? "Création de l’image (jusqu’à une minute)…" : "Générer le visuel"}
        </button>
      </div>
      {error && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-red-800">{error}</p>}
      {images.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((i) => (
            <li key={i.id} className="rounded-lg border border-line bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/admin/marketing/images/${i.id}`} alt={i.headline || "Visuel généré"} loading="lazy" className="w-full rounded bg-ink" />
              <p className="mt-1 text-xs font-semibold">Visuel n° {i.id}</p>
              <p className="flex flex-wrap gap-x-3 text-xs">
                <a href={`/admin/marketing/images/${i.id}?telecharger`} className="inline-flex items-center gap-1 underline"><Download className="size-3.5" aria-hidden />Visuel</a>
                <a href={`/admin/marketing/images/${i.id}?photo&telecharger`} className="inline-flex items-center gap-1 underline"><Download className="size-3.5" aria-hidden />Photo seule</a>
              </p>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
