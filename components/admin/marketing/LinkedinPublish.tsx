"use client";

import { Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { publishPostOnLinkedin } from "@/app/admin/marketing/actions";

/** "Publier sur LinkedIn", with an optional image and a confirmation (Ben, 03/10). */
export function LinkedinPublish({ postId }: { postId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; url?: string } | null>(null);
  const [pending, run] = useTransition();

  if (!open) return <button type="button" onClick={() => setOpen(true)} className={ghost}><Share2 className="size-4" aria-hidden />Publier sur LinkedIn</button>;

  return (
    <form
      className="grid w-full gap-2 rounded-lg bg-slate-50 p-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        run(async () => {
          const r = await publishPostOnLinkedin(data);
          setResult(r.ok ? { ok: true, text: "Publié sur votre profil LinkedIn.", url: r.url } : { ok: false, text: r.error });
          if (r.ok) router.refresh();
        });
      }}
    >
      <input type="hidden" name="postId" value={postId} />
      <label className="flex flex-col gap-1">Image, facultative (JPG ou PNG, 4 Mo au plus)
        <input type="file" name="image" accept="image/jpeg,image/png" className="text-sm" /></label>
      <p className="text-muted">Le texte part tel qu&apos;il est dans la bibliothèque, avec son lien suivi, sur votre profil, en public.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={pending || result?.ok} className={primary}><Share2 className="size-4" aria-hidden />{pending ? "Publication…" : "Oui, publier"}</button>
        <button type="button" disabled={pending} onClick={() => { setOpen(false); setResult(null); }} className={ghost}>Annuler</button>
      </div>
      {result && <p className={result.ok ? "text-accent-ink" : "text-red-800"}>{result.text} {result.url && <a href={result.url} target="_blank" rel="noopener" className="underline">Voir le post</a>}</p>}
    </form>
  );
}

const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold";
const primary = "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white";
