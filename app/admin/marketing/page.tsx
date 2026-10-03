import { BarChart3, BookMarked, Lightbulb, Megaphone, Sparkles, Trash2, Users } from "lucide-react";
import Link from "next/link";

import { CopyButton, Studio } from "@/components/admin/marketing/Studio";
import { FollowupRow } from "@/components/admin/marketing/FollowupRow";
import { ImagePanel } from "@/components/admin/marketing/ImagePanel";
import { LinkedinPublish } from "@/components/admin/marketing/LinkedinPublish";
import { VideoPanel } from "@/components/admin/marketing/VideoPanel";
import { examBootEnabled } from "@/lib/examboot/client";
import { cockpit, cohortFacts, followupSegments, libraryWithResults, marketingCohorts, recentPosts } from "@/lib/marketing/data";
import { CANVAS, defaultKeyword } from "@/lib/marketing/brand";
import { CHANNELS, DESTINATIONS, FORMATS, MIN_SAMPLE_FOR_STATS, PILLARS, editorialBalance, pillarOf } from "@/lib/marketing/plan";
import { linkedinStatus } from "@/lib/linkedin";
import { minimaxEnabled } from "@/lib/minimax";
import { loadMarketingSettings } from "@/lib/marketing/settings";
import { PROGRAMS } from "@/lib/programs";

import { deletePost, saveTestThreshold, togglePublished } from "./actions";

export const dynamic = "force-dynamic";
// The studio's web search can take a minute or two.
export const maxDuration = 300;

/** Cohort marketing (Ben, 28/09): where the cohort stands, content to publish, people to follow up. */
export default async function MarketingPage({ searchParams }: { searchParams: Promise<{ cohorte?: string }> }) {
  const { cohorte } = await searchParams;
  const cohorts = await marketingCohorts();
  const selected = cohorts.find((c) => String(c.id) === cohorte) ?? cohorts.find((c) => c.status === "open") ?? cohorts[0];

  if (!selected) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Megaphone className="size-6 text-accent" aria-hidden />Marketing</h1>
        <p className="mt-3 text-muted">Aucune cohorte à venir. <Link href="/admin/cohortes" className="underline">Créez une cohorte</Link> pour préparer sa promotion.</p>
      </main>
    );
  }

  const [facts, settings] = await Promise.all([cohortFacts(selected.id), loadMarketingSettings()]);
  if (!facts) return null;
  const threshold = settings.testThreshold;
  const testOn = examBootEnabled();
  const [cp, segments, library, recent, linkedin] = await Promise.all([cockpit(facts, threshold), followupSegments(facts.program, threshold), libraryWithResults(facts.id), recentPosts(), linkedinStatus()]);
  const balance = editorialBalance(recent);
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Aujourd&apos;hui</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Megaphone className="size-6 text-accent" aria-hidden />Marketing de la cohorte</h1>

      {cohorts.length > 1 && (
        <nav className="mt-3 flex flex-wrap gap-2 text-sm">
          {cohorts.map((c) => (
            <Link key={c.id} href={`/admin/marketing?cohorte=${c.id}`} className={"rounded-full border px-3 py-1 font-semibold " + (c.id === selected.id ? "border-ink bg-ink text-white" : "border-line bg-white")}>
              {c.name} · {PROGRAMS[c.program].name.split(" ")[0]}
            </Link>
          ))}
        </nav>
      )}

      {/* 1. Cockpit */}
      <section className="mt-5 rounded-xl border border-line bg-white p-4">
        <h2 className={h2}><BarChart3 className="size-4 text-accent" aria-hidden />Où en est la cohorte</h2>
        <p className="mt-2 text-sm text-muted">{facts.name} · démarre le {fmt(facts.startsAt)} · admissions jusqu&apos;au {fmt(facts.admissionClosesAt)}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi value={`${facts.paid}/${facts.capacity}`} label="places payées" />
          <Kpi value={String(facts.pace.remaining)} label={`libres${facts.held ? ` (${facts.held} tenue${facts.held > 1 ? "s" : ""})` : ""}`} />
          <Kpi value={String(facts.pace.daysLeft)} label="jours avant clôture" />
          <Kpi value={String(cp.paid30)} label="inscriptions en 30 j" />
        </div>
        <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-ink">{facts.pace.label}</p>
        <p className="mt-3 text-sm text-muted">30 derniers jours : {testOn ? `${cp.tests30} tests d’entraînement faits → ` : ""}{cp.scans30} analyses de profil ({cp.scans7} cette semaine) → {cp.calls30} appels réservés → {cp.paid30} inscriptions payées.</p>
        {testOn && (
          <p className="mt-1 text-sm text-muted">
            {cp.testStats
              ? `Chiffres publiables : score moyen ${cp.testStats.averagePercent} %, ${cp.testStats.atOrAbove} % à ${threshold} % ou plus, sur ${cp.testStats.count} tests. Le studio peut les citer.`
              : `Chiffres du test non publiables : moins de ${MIN_SAMPLE_FOR_STATS} tests en 30 jours. Le studio n’en cite aucun.`}
          </p>
        )}
        {cp.todo.length > 0 && (
          <div className="mt-3">
            <p className="flex items-center gap-1.5 text-xs font-extrabold tracking-[.06em] text-muted uppercase"><Lightbulb className="size-3.5" aria-hidden />Aujourd&apos;hui</p>
            <ul className="mt-1 grid gap-1 text-sm">{cp.todo.map((t) => <li key={t}>• {t}</li>)}</ul>
          </div>
        )}
      </section>

      {/* 2. Studio */}
      <section className="mt-6 rounded-xl border border-line bg-white p-4">
        <h2 className={h2}><Sparkles className="size-4 text-accent" aria-hidden />Studio de contenu</h2>
        <p className="mt-1 mb-3 text-sm text-muted">Environ quatre posts de valeur (méthode, carrière, certifications, éligibilité, vie du candidat) pour un post de vente. Chaque post a une seule action : test, analyse de profil, conseil carrière ou cohorte. Chaque variante a son brief visuel (direction « Nuit et vert ») et son lien suivi ; pour TikTok, un storyboard et le prompt vidéo pour MiniMax.</p>
        <Studio
          cohortId={facts.id}
          channels={Object.entries(CHANNELS).map(([value, c]) => ({ value, label: c.label }))}
          pillars={Object.entries(PILLARS).map(([value, p]) => ({ value, label: p.label, destination: p.destination, examples: p.examples }))}
          formats={Object.entries(FORMATS).map(([value, f]) => ({ value, label: f.label, channels: f.channels }))}
          destinations={Object.entries(DESTINATIONS).filter(([k]) => testOn || k !== "test").map(([value, d]) => ({ value, label: d.label }))}
        />
      </section>

      {/* 3. Library and results */}
      <section className="mt-6 rounded-xl border border-line bg-white p-4">
        <h2 className={h2}><BookMarked className="size-4 text-accent" aria-hidden />Bibliothèque et résultats</h2>
        {linkedin.state !== "connected" ? (
          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">Publication LinkedIn directe : {linkedin.state === "expired" ? "connexion expirée, " : ""}<Link href="/admin/parametres/linkedin" className="underline">{linkedin.state === "not_configured" ? "à configurer" : "connecter LinkedIn"}</Link>.</p>
        ) : linkedin.expiresSoon ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">La connexion LinkedIn expire le {linkedin.expiresAt.toLocaleDateString("fr-FR")} : <Link href="/admin/parametres/linkedin" className="underline">reconnecter</Link>.</p>
        ) : null}
        <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <p className="font-semibold">Équilibre éditorial, 30 derniers jours ({recent.length} post{recent.length > 1 ? "s" : ""})</p>
          <p className="mt-1 text-muted">{(Object.keys(PILLARS) as Array<keyof typeof PILLARS>).map((k) => `${PILLARS[k].label} ${balance.byPillar[k]}`).join(" · ")}</p>
          <p className="text-muted">Liens : {(Object.keys(DESTINATIONS) as Array<keyof typeof DESTINATIONS>).map((k) => `${DESTINATIONS[k].label.toLowerCase()} ${balance.byDestination[k]}`).join(" · ")}</p>
          {balance.advice && <p className="mt-1 font-semibold text-accent-ink">{balance.advice}</p>}
        </div>
        {library.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Gardez une variante du studio : elle apparaît ici avec ce que son lien a rapporté.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {library.map((p) => (
              <li key={p.id} className="rounded-lg border border-line p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{CHANNELS[p.channel as keyof typeof CHANNELS]?.label ?? p.channel} · {PILLARS[pillarOf(p)].label}{p.format && p.format !== "standard" ? ` · ${FORMATS[p.format as keyof typeof FORMATS]?.label ?? p.format}` : ""} · vers {DESTINATIONS[p.destination as keyof typeof DESTINATIONS]?.label.toLowerCase() ?? p.destination}</span>
                  <span className="text-muted">{p.visitors} visiteur{p.visitors > 1 ? "s" : ""} · {p.destination === "test" || p.tests > 0 ? `${p.tests} test${p.tests > 1 ? "s" : ""} ouvert${p.tests > 1 ? "s" : ""} (${p.testsDone} fait${p.testsDone > 1 ? "s" : ""}) · ` : ""}{p.leads} analyse{p.leads > 1 ? "s" : ""} · {p.paid} inscription{p.paid > 1 ? "s" : ""} · {p.code}</span>
                </div>
                {p.topic && <p className="mt-1 text-xs text-muted">Sujet : {p.topic}</p>}
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-ink-2">{p.text}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CopyButton value={p.text} label="Copier" />
                  {p.channel === "linkedin" && linkedin.state === "connected" && !p.linkedinUrn && <LinkedinPublish postId={p.id} images={p.images.map((i) => ({ id: i.id, headline: i.headline }))} />}
                  {p.linkedinUrn && <a href={`https://www.linkedin.com/feed/update/${p.linkedinUrn}/`} target="_blank" rel="noopener" className={ghost}>Voir sur LinkedIn</a>}
                  <form action={togglePublished}><input type="hidden" name="postId" value={p.id} /><button className={ghost}>{p.publishedAt ? `Publié le ${p.publishedAt.toLocaleDateString("fr-FR")}` : "Marquer publié"}</button></form>
                  <form action={deletePost}><input type="hidden" name="postId" value={p.id} /><button className={ghost} aria-label="Supprimer"><Trash2 className="size-4" aria-hidden /></button></form>
                </div>
                {minimaxEnabled() && <ImagePanel postId={p.id} size={canvasLabel(p.channel)} defaults={imageDefaults(p.visualBrief)} initial={p.images.map((i) => ({ id: i.id, headline: i.headline, createdAt: i.createdAt.toISOString() }))} />}
                {p.channel === "tiktok" && minimaxEnabled() && <VideoPanel postId={p.id} defaultPrompt={openingPrompt(p.video)} images={p.images.map((i) => ({ id: i.id, headline: i.headline }))} initial={p.videos.map((v) => ({ id: v.id, status: v.status, error: v.error, prompt: v.prompt, ready: Boolean(v.blobPathname), createdAt: v.createdAt.toISOString() }))} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Follow-ups */}
      <section className="mt-6 rounded-xl border border-line bg-white p-4">
        <h2 className={h2}><Users className="size-4 text-accent" aria-hidden />Relances ciblées</h2>
        <p className="mt-1 text-sm text-muted">Seulement les personnes qui ont accepté d&apos;être recontactées, sans place payée, pas relancées d&apos;ici depuis 3 jours. Classées selon ce qu&apos;elles ont fait : appel, score au test, analyse. Un message personnel chacun, envoyé par vous : jamais d&apos;envoi groupé.</p>
        {testOn && (
          <form action={saveTestThreshold} className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <label htmlFor="testThreshold" className="font-medium">Seuil du test</label>
            <input id="testThreshold" name="testThreshold" type="number" min={20} max={100} step={5} defaultValue={threshold} className="w-20 rounded-lg border border-line px-2 py-1 text-base" />
            <span className="text-muted">% · à partir de ce score : « Test réussi » ; en dessous : « Test à consolider ».</span>
            <button className={ghost}>Enregistrer</button>
          </form>
        )}
        <div className="mt-3 grid gap-4">
          {segments.map((s) => (
            <details key={s.key} open={s.leads.length > 0 && s.key === segments[0].key} className="rounded-lg border border-line p-3">
              <summary className="cursor-pointer font-semibold">{s.label} <span className="font-normal text-muted">· {s.leads.length} · {s.hint}</span></summary>
              {s.leads.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Personne pour l&apos;instant.</p>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {s.leads.slice(0, 25).map((l) => <FollowupRow key={l.id} lead={{ ...l, lastContactAt: l.lastContactAt?.toISOString() ?? null }} cohortId={facts.id} segment={s.key} />)}
                </ul>
              )}
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}

/** The MiniMax prompt the studio wrote for the opening shot. */
function openingPrompt(video: string | null): string {
  try {
    return (JSON.parse(video ?? "{}") as { minimaxPrompt?: string }).minimaxPrompt ?? "";
  } catch {
    return "";
  }
}

function Kpi({ value, label }: { value: string; label: string }) {
  return <div className="rounded-lg border border-line px-3 py-2"><div className="display text-2xl font-black">{value}</div><div className="text-xs text-muted">{label}</div></div>;
}

const h2 = "flex items-center gap-2 text-xs font-extrabold tracking-[.06em] text-muted uppercase";
const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold";

/** The image panel's starting values, from the post's visual brief. */
function imageDefaults(visualBrief: string): { scene: string; headline: string; keyword: string } {
  try {
    const v = JSON.parse(visualBrief) as { scene?: string; onScreenText?: string; imagePrompt?: string };
    const headline = (v.onScreenText ?? "").replace(/^[«"“]\s*|\s*[»"”]$/g, "").slice(0, 70);
    return { scene: v.imagePrompt || v.scene || "", headline, keyword: defaultKeyword(headline) };
  } catch {
    return { scene: "", headline: "", keyword: "" };
  }
}

function canvasLabel(channel: string): string {
  const c = CANVAS[channel as keyof typeof CANVAS] ?? CANVAS.linkedin;
  return `${c.width} × ${c.height}`;
}
