"use client";

import { Check, Clapperboard, Copy, ImageIcon, Lightbulb, Save, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { generatePosts, savePost, type StudioVariant, suggestTopicIdeas } from "@/app/admin/marketing/actions";
import type { NewsItem, TopicIdea } from "@/lib/marketing/ai";

type Option = { value: string; label: string };
type PillarOption = Option & { destination: string; examples: readonly string[] };
type FormatOption = Option & { channels: readonly string[] };
type Meta = { channel: string; pillar: string; format: string; topic: string };

/**
 * The AI content studio (Ben, 28/09 and 30/09): subject ideas from what
 * prospects say, and the news when asked; then channel, pillar, format and
 * where the link leads; three variants to edit, copy, keep.
 */
export function Studio({ cohortId, channels, pillars, formats, destinations }: { cohortId: number; channels: Option[]; pillars: PillarOption[]; formats: FormatOption[]; destinations: Option[] }) {
  const has = (d: string) => destinations.some((x) => x.value === d);
  const destFor = (p: string) => { const d = pillars.find((x) => x.value === p)?.destination ?? "scanner"; return has(d) ? d : "scanner"; };
  const [channel, setChannel] = useState(channels[0].value);
  const [pillar, setPillar] = useState(pillars[0].value);
  const [format, setFormat] = useState("standard");
  const [destination, setDestination] = useState(destFor(pillars[0].value));
  const [topic, setTopic] = useState("");
  const [brief, setBrief] = useState("");
  const [variants, setVariants] = useState<StudioVariant[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const [withNews, setWithNews] = useState(false);
  const [ideas, setIdeas] = useState<TopicIdea[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [ideasNote, setIdeasNote] = useState<string | null>(null);
  const [ideasPending, startIdeas] = useTransition();

  const formatsHere = formats.filter((f) => f.channels.includes(channel));
  const examples = pillars.find((p) => p.value === pillar)?.examples ?? [];

  const changeChannel = (c: string) => {
    setChannel(c);
    if (!formats.find((f) => f.value === format)?.channels.includes(c)) setFormat("standard");
  };
  const changePillar = (p: string) => {
    setPillar(p);
    setDestination(destFor(p));
  };

  const suggest = () =>
    startIdeas(async () => {
      setIdeasNote(null);
      const result = await suggestTopicIdeas({ cohortId, withNews });
      if (result.ok) {
        setIdeas(result.ideas);
        setNews(result.news);
        if (result.newsError) setIdeasNote(`Actualité : ${result.newsError} Les idées viennent de vos données.`);
      } else setIdeasNote(result.error);
    });

  const pickIdea = (i: TopicIdea) => {
    setChannel(i.channel);
    setPillar(i.pillar);
    setFormat(formats.find((f) => f.value === i.format)?.channels.includes(i.channel) ? i.format : "standard");
    setDestination(has(i.destination) ? i.destination : destFor(i.pillar));
    setTopic(`${i.title}\nAccroche proposée : ${i.hook}${i.source ? `\nSource à citer : ${i.source}` : ""}`);
    document.getElementById("studio-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const generate = () =>
    start(async () => {
      setError(null);
      const result = await generatePosts({ cohortId, channel, pillar, format, topic, destination, brief });
      if (result.ok) {
        setVariants(result.variants);
        setMeta({ channel, pillar, format, topic: topic.split("\n")[0].slice(0, 240) });
      } else setError(result.error);
    });

  return (
    <div className="grid gap-4">
      <div className="rounded-lg bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-[.06em] text-muted uppercase"><Lightbulb className="size-3.5" aria-hidden />Idées de sujets</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={withNews} onChange={(e) => setWithNews(e.target.checked)} />Inclure l&apos;actualité (recherche web)</label>
            <button type="button" onClick={suggest} disabled={ideasPending} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold">
              <Sparkles className="size-4" aria-hidden />{ideasPending ? (withNews ? "Recherche… (1 à 2 min)" : "Réflexion… (30 s)") : ideas.length ? "Dix autres idées" : "Proposer 10 sujets"}
            </button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted">Tirées de ce que vos prospects écrivent et font (anonymisé), de ce que vous avez déjà publié ce mois-ci et, si coché, de l&apos;actualité avec sa source.</p>
        {ideasNote && <p className="mt-2 rounded bg-white px-2 py-1 text-sm">{ideasNote}</p>}
        {news.length > 0 && (
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer font-semibold">Actualités trouvées ({news.length})</summary>
            <ul className="mt-1 grid gap-1">{news.map((n) => <li key={n.url}><a href={n.url} target="_blank" rel="noopener" className="underline">{n.title}</a> <span className="text-muted">· {n.date} · {n.why}</span></li>)}</ul>
          </details>
        )}
        {ideas.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {ideas.map((i, k) => (
              <li key={k} className="rounded-lg border border-line bg-white p-3 text-sm">
                <p className="text-xs text-muted">{pillars.find((p) => p.value === i.pillar)?.label} · {formats.find((f) => f.value === i.format)?.label} · {channels.find((c) => c.value === i.channel)?.label} · lien vers {destinations.find((d) => d.value === i.destination)?.label.toLowerCase() ?? i.destination}</p>
                <p className="mt-1 font-semibold">{i.title}</p>
                <p className="mt-0.5 italic">« {i.hook} »</p>
                <p className="mt-0.5 text-muted">{i.why}{i.source && <> · <a href={i.source} target="_blank" rel="noopener" className="underline">source</a></>}</p>
                <button type="button" onClick={() => pickIdea(i)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1 font-semibold">Utiliser ce sujet</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div id="studio-form" className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Canal</span>
          <select value={channel} onChange={(e) => changeChannel(e.target.value)} className={input}>{channels.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Pilier</span>
          <select value={pillar} onChange={(e) => changePillar(e.target.value)} className={input}>{pillars.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={input}>{formatsHere.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Le lien mène à</span>
          <select value={destination} onChange={(e) => setDestination(e.target.value)} className={input}>{destinations.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select></label>
      </div>
      <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Sujet</span>
        <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={2} maxLength={600} placeholder="Choisissez une idée ci-dessus, un exemple ci-dessous, ou écrivez le vôtre" className={input} /></label>
      <div className="flex flex-wrap gap-1.5">
        {examples.map((x) => <button key={x} type="button" onClick={() => setTopic(x)} className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs">{x}</button>)}
      </div>
      <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Ce que je veux dire, facultatif</span>
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} maxLength={1200} placeholder="Une anecdote d'appel, votre avis, une question reçue… ou une consigne (« viser les RSSI au Sénégal »)" className={input} /></label>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">Aucun chiffre ni témoignage inventé : dates, places et prix viennent de la cohorte, les chiffres du test seulement s&apos;il y en a assez.</p>
        <button type="button" onClick={generate} disabled={pending} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white">
          <Sparkles className="size-4" aria-hidden />{pending ? "Rédaction… (20 s environ)" : variants.length ? "Trois autres variantes" : "Générer trois variantes"}
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {meta && variants.map((v) => <VariantCard key={v.code} variant={v} cohortId={cohortId} meta={meta} />)}
    </div>
  );
}

function VariantCard({ variant, cohortId, meta }: { variant: StudioVariant; cohortId: number; meta: Meta }) {
  const { channel } = meta;
  const [text, setText] = useState(variant.hashtags.length && !variant.text.includes("#") ? `${variant.text}\n\n${variant.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}` : variant.text);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const hasVideo = channel === "tiktok" && variant.video.scenes.length > 0;

  const save = () =>
    start(async () => {
      const result = await savePost({ cohortId, channel: channel as never, pillar: meta.pillar as never, format: meta.format as never, topic: meta.topic, destination: variant.destination, code: variant.code, text, visual: variant.visual, video: hasVideo ? variant.video : null });
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
