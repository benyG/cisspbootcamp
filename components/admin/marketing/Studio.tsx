"use client";

import { Check, Clapperboard, Copy, ImageIcon, Save, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { generatePosts, savePost, type StudioVariant } from "@/app/admin/marketing/actions";

type Option = { value: string; label: string };

/** The AI content studio: channel, angle, a note; three variants to edit, copy, keep. */
export function Studio({ cohortId, channels, angles }: { cohortId: number; channels: Option[]; angles: Option[] }) {
  const [channel, setChannel] = useState(channels[0].value);
  const [angle, setAngle] = useState(angles[0].value);
  const [brief, setBrief] = useState("");
  const [variants, setVariants] = useState<StudioVariant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const generate = () =>
    start(async () => {
      setError(null);
      const result = await generatePosts({ cohortId, channel, angle, brief });
      if (result.ok) setVariants(result.variants);
      else setError(result.error);
    });

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Canal</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className={input}>{channels.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Angle</span>
          <select value={angle} onChange={(e) => setAngle(e.target.value)} className={input}>{angles.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></label>
      </div>
      <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Consigne, facultative</span>
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} maxLength={600} placeholder="ex. viser les RSSI au Sénégal, ton plus direct, parler du mercredi lecture" className={input} /></label>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">L&apos;IA n&apos;utilise que les faits de la cohorte : dates, places, prix. Aucun chiffre ni témoignage inventé.</p>
        <button type="button" onClick={generate} disabled={pending} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white">
          <Sparkles className="size-4" aria-hidden />{pending ? "Rédaction… (20 s environ)" : variants.length ? "Trois autres variantes" : "Générer trois variantes"}
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {variants.map((v) => <VariantCard key={v.code} variant={v} cohortId={cohortId} channel={channel} angle={angle} />)}
    </div>
  );
}

function VariantCard({ variant, cohortId, channel, angle }: { variant: StudioVariant; cohortId: number; channel: string; angle: string }) {
  const [text, setText] = useState(variant.hashtags.length && !variant.text.includes("#") ? `${variant.text}\n\n${variant.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}` : variant.text);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const hasVideo = channel === "tiktok" && variant.video.scenes.length > 0;

  const save = () =>
    start(async () => {
      const result = await savePost({ cohortId, channel: channel as never, angle: angle as never, code: variant.code, text, visual: variant.visual, video: hasVideo ? variant.video : null });
      setSaved(result.ok);
    });

  return (
    <article className="grid gap-3 rounded-xl border border-line bg-white p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">{variant.title}</h3>
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-muted">lien suivi · {variant.code}</span>
      </div>
      <textarea value={text} onChange={(e) => { setText(e.target.value); setSaved(false); }} rows={Math.min(16, Math.max(5, text.split("\n").length + 2))} className={input + " font-[inherit] leading-relaxed"} />
      <div className="flex flex-wrap gap-2">
        <CopyButton value={text} label="Copier le texte" />
        <button type="button" onClick={save} disabled={pending || saved} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold">
          {saved ? <Check className="size-4 text-accent" aria-hidden /> : <Save className="size-4" aria-hidden />}{saved ? "Dans la bibliothèque" : "Garder dans la bibliothèque"}
        </button>
      </div>
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-[.06em] text-muted uppercase"><ImageIcon className="size-3.5" aria-hidden />Brief visuel</p>
        <p className="mt-1"><b>{variant.visual.format}</b></p>
        <p className="mt-1">{variant.visual.scene}</p>
        <p className="mt-1">Texte à l&apos;écran : <b>« {variant.visual.onScreenText} »</b></p>
        <p className="mt-1 text-muted">{variant.visual.direction}</p>
      </div>
      {hasVideo && (
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-[.06em] text-muted uppercase"><Clapperboard className="size-3.5" aria-hidden />Storyboard TikTok</p>
          <ol className="mt-2 grid gap-2">
            {variant.video.scenes.map((s, i) => (
              <li key={i} className="grid gap-0.5 border-l-2 border-accent pl-3">
                <span className="text-xs font-bold text-muted">Plan {i + 1} · {s.seconds} s</span>
                <span>{s.image}</span>
                {s.voiceover && <span className="text-ink-2">Voix : « {s.voiceover} »</span>}
                {s.onScreen && <span className="text-ink-2">À l&apos;écran : <b>{s.onScreen}</b></span>}
              </li>
            ))}
          </ol>
          {variant.video.minimaxPrompt && (
            <div className="mt-3">
              <p className="text-xs font-bold text-muted">Prompt vidéo (MiniMax, plan d&apos;ouverture de 6 s)</p>
              <p className="mt-1 rounded bg-white p-2 font-mono text-xs">{variant.video.minimaxPrompt}</p>
              <div className="mt-2"><CopyButton value={variant.video.minimaxPrompt} label="Copier le prompt vidéo" /></div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          setDone(false);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold"
    >
      {done ? <Check className="size-4 text-accent" aria-hidden /> : <Copy className="size-4" aria-hidden />}{done ? "Copié" : label}
    </button>
  );
}

const input = "rounded-lg border border-line px-3 py-2 text-base";
