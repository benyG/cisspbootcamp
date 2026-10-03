"use client";

import { Clapperboard, Download } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { type VideoRow, generateVideo, refreshVideos } from "@/app/admin/marketing/actions";

const POLL_MS = 15_000;
const LABEL: Record<string, string> = { queued: "En file d’attente", processing: "En cours de génération", done: "Prête", failed: "Échec" };

/**
 * MiniMax clips of a TikTok post (Ben, 03/10): the opening shot's prompt is
 * prefilled and editable; each click makes one 6-second clip. While a clip
 * is being made, the panel checks every 15 seconds.
 */
export function VideoPanel({ postId, defaultPrompt, initial, images = [] }: { postId: number; defaultPrompt: string; initial: VideoRow[]; images?: Array<{ id: number; headline: string }> }) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [imageId, setImageId] = useState<number | null>(null);
  const [videos, setVideos] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, run] = useTransition();
  const waiting = videos.some((v) => v.status === "queued" || v.status === "processing");

  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => {
      refreshVideos({ postId }).then(setVideos).catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [waiting, postId]);

  return (
    <details className="mt-2 w-full rounded-lg bg-slate-50 p-3 text-sm" open={videos.length > 0}>
      <summary className="flex cursor-pointer items-center gap-1.5 font-semibold"><Clapperboard className="size-4" aria-hidden />Vidéo MiniMax{videos.length ? ` · ${videos.length} plan${videos.length > 1 ? "s" : ""}` : ""}</summary>
      <label className="mt-2 flex flex-col gap-1">Prompt du plan (anglais, 6 s, sans texte à l&apos;écran)
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} maxLength={1200} className="rounded-lg border border-line px-3 py-2 font-mono text-xs" /></label>
      {images.length > 0 && (
        <label className="mt-2 flex flex-col gap-1">Image de départ (la photo du visuel, sans le titre)
          <select value={imageId ?? ""} onChange={(e) => setImageId(e.target.value ? Number(e.target.value) : null)} className="rounded-lg border border-line bg-white px-3 py-2 text-base">
            <option value="">Aucune : la vidéo part du prompt seul</option>
            {images.map((i) => <option key={i.id} value={i.id}>Visuel n° {i.id}{i.headline ? ` · ${i.headline}` : ""}</option>)}
          </select></label>
      )}
      <p className="mt-1 text-xs text-muted">La charte vidéo (plans lents, bleu nuit et touche de vert, professionnels africains de la cyber, aucun texte ni cliché) est ajoutée d&apos;office au prompt. Un clic = un plan de 6 secondes, facturé par MiniMax. Pour une vidéo de 15 à 30 s, générez plusieurs plans (adaptez le prompt à chaque plan du storyboard), puis assemblez-les avec le texte et la voix dans CapCut.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" disabled={pending} onClick={() => run(async () => { setError(null); const r = await generateVideo({ postId, prompt, imageId }); if (r.ok) setVideos(r.videos); else setError(r.error); })} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white">
          <Clapperboard className="size-4" aria-hidden />{pending ? "Envoi à MiniMax…" : "Générer ce plan (6 s)"}
        </button>
        {waiting && <span className="text-muted">Génération en cours, quelques minutes : vous pouvez quitter la page, elle continue.</span>}
      </div>
      {error && <p className="mt-2 rounded bg-red-50 px-2 py-1 text-red-800">{error}</p>}
      {videos.length > 0 && (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {videos.map((v) => (
            <li key={v.id} className="rounded-lg border border-line bg-white p-2">
              <p className="text-xs font-semibold">{LABEL[v.status] ?? v.status} · {new Date(v.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              {v.ready ? (
                <>
                  <video src={`/admin/marketing/videos/${v.id}`} controls playsInline preload="metadata" className="mt-1 aspect-[9/16] max-h-80 w-full rounded bg-black object-contain" />
                  <a href={`/admin/marketing/videos/${v.id}?telecharger`} className="mt-1 inline-flex items-center gap-1 text-xs underline"><Download className="size-3.5" aria-hidden />Télécharger le MP4</a>
                </>
              ) : v.error ? <p className="mt-1 text-xs text-red-800">{v.error}</p> : <p className="mt-1 text-xs text-muted">Patientez…</p>}
              <p className="mt-1 line-clamp-2 font-mono text-[11px] text-muted">{v.prompt}</p>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
