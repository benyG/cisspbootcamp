"use client";

import { upload } from "@vercel/blob/client";
import { CloudUpload, FileArchive, HardDrive, Search, Send, Trash2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  attachLabAction,
  checkVideoAction,
  driveStepAction,
  driveVideosAction,
  finishUploadAction,
  publishAction,
  removeLabAction,
  removeVideoAction,
  startDriveAction,
  startUploadAction,
} from "@/app/admin/replays/actions";
import type { DriveVideo } from "@/lib/drive";
import { formatBytes, formatDuration } from "@/lib/replays";

export type ItemView = {
  id: number;
  title: string;
  modulesLabel: string;
  videoStatus: string;
  videoName: string | null;
  videoError: string | null;
  durationSec: number | null;
  source: string | null;
  size: number | null;
  offset: number | null;
  labName: string | null;
  labSize: number | null;
  /** cohortId → lead ids already given access in that cohort. */
  granted: Record<number, number[]>;
  /** cohortId → "J3–J4" in that cohort's calendar. */
  daysByCohort: Record<number, string>;
};
export type CohortOption = { id: number; name: string; people: Array<{ id: number; name: string }> };

const CHUNK = 50 * 1024 * 1024; // multiple of 256 KiB, as Cloudflare asks

/**
 * One recording of the library (Ben, 12/10): its video (from the computer,
 * in resumable pieces straight to Cloudflare, or copied from Google Drive
 * by the server), its lab ZIP, and publication to the participants of any
 * cohort of the programme.
 */
export function ReplayItemCard({ item, cohorts, defaultCohortId, streamReady }: { item: ItemView; cohorts: CohortOption[]; defaultCohortId: number | null; streamReady: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drive, setDrive] = useState<{ open: boolean; search: string; videos: DriveVideo[] | null; error: string | null }>({ open: false, search: "", videos: null, error: null });
  const [cohortId, setCohortId] = useState<number | null>(defaultCohortId ?? cohorts[0]?.id ?? null);
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, run] = useTransition();
  const videoInput = useRef<HTMLInputElement>(null);
  const labInput = useRef<HTMLInputElement>(null);

  // Keeps a Drive copy going while the page is open (the cron takes over otherwise).
  useEffect(() => {
    if (item.videoStatus !== "uploading" || item.source !== "drive") return;
    let stop = false;
    (async () => {
      while (!stop) {
        const r = await driveStepAction({ itemId: item.id }).catch(() => null);
        if (!r || stop) break;
        if (r.size) setProgress(Math.round((r.offset / r.size) * 100));
        if (r.status !== "uploading") { router.refresh(); break; }
        if (r.error) { setError(r.error); await new Promise((res) => setTimeout(res, 15_000)); }
      }
    })();
    return () => { stop = true; };
  }, [item.id, item.videoStatus, item.source, router]);

  // While Cloudflare prepares the video, ask every 20 seconds.
  useEffect(() => {
    if (item.videoStatus !== "processing") return;
    const timer = window.setInterval(() => { checkVideoAction({ itemId: item.id }).then((changed) => changed && router.refresh()).catch(() => undefined); }, 20_000);
    return () => window.clearInterval(timer);
  }, [item.id, item.videoStatus, router]);

  const sendVideo = async (file: File) => {
    setError(null); setBusy("video"); setProgress(0);
    try {
      const start = await startUploadAction({ itemId: item.id, name: file.name, size: file.size });
      if (!start.ok) throw new Error(start.error);
      let offset = 0;
      while (offset < file.size) {
        const chunk = file.slice(offset, offset + CHUNK);
        let sent = false;
        for (let attempt = 0; attempt < 4 && !sent; attempt++) {
          try {
            const res = await fetch(start.uploadUrl, { method: "PATCH", headers: { "Tus-Resumable": "1.0.0", "Upload-Offset": String(offset), "Content-Type": "application/offset+octet-stream" }, body: chunk });
            if (!res.ok) throw new Error(String(res.status));
            const next = Number(res.headers.get("Upload-Offset"));
            offset = Number.isFinite(next) && next > offset ? next : offset + chunk.size;
            sent = true;
          } catch {
            await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
            // Ask Cloudflare where it stands before retrying.
            const head = await fetch(start.uploadUrl, { method: "HEAD", headers: { "Tus-Resumable": "1.0.0" } }).catch(() => null);
            const at = Number(head?.headers.get("Upload-Offset"));
            if (Number.isFinite(at) && at > offset) { offset = at; sent = true; }
          }
        }
        if (!sent) throw new Error("La connexion a coupé pendant l'envoi : relancez-le.");
        setProgress(Math.round((offset / file.size) * 100));
      }
      await finishUploadAction({ itemId: item.id });
      setMessage("Vidéo envoyée : Cloudflare la prépare (quelques minutes).");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'envoi a échoué.");
    } finally {
      setBusy(null); setProgress(null);
    }
  };

  const sendLab = async (file: File) => {
    setError(null); setBusy("lab"); setProgress(0);
    try {
      const safe = file.name.replace(/[^\w.-]+/g, "-").slice(-120);
      const blob = await upload(`replays/labs/item-${item.id}/${safe}`, file, {
        access: "private",
        handleUploadUrl: "/api/admin/replays/lab",
        contentType: file.type || "application/zip",
        multipart: file.size > 8 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      const r = await attachLabAction({ itemId: item.id, pathname: blob.pathname, name: file.name });
      if (!r.ok) throw new Error(r.error);
      setMessage(r.message);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "L'envoi du lab a échoué.");
    } finally {
      setBusy(null); setProgress(null);
    }
  };

  const searchDrive = (search: string) => run(async () => {
    const r = await driveVideosAction({ search });
    setDrive((d) => ({ ...d, open: true, videos: r.ok ? r.videos : null, error: r.ok ? null : r.error }));
  });

  const publish = (leadIds: number[] | "all") => run(async () => {
    if (!cohortId) return;
    setError(null);
    const r = await publishAction({ itemId: item.id, cohortId, leadIds });
    if (r.ok) { setMessage(r.message); setSelected([]); router.refresh(); } else setError(r.error);
  });

  const status = item.videoStatus;
  const publishable = status === "ready" || (status === "none" && item.labName);
  const cohort = cohorts.find((c) => c.id === cohortId) ?? null;
  const grantedHere = cohort ? item.granted[cohort.id] ?? [] : [];
  const notGranted = cohort ? cohort.people.filter((p) => !grantedHere.includes(p.id)) : [];
  const grantSummary = cohorts.filter((c) => (item.granted[c.id] ?? []).length).map((c) => `${c.name} (${item.granted[c.id].length})`).join(" · ");

  return (
    <div className="grid gap-3">
      <div className="grid gap-0.5">
        <h2 className="font-semibold">{item.title}</h2>
        {item.modulesLabel && <p className="text-xs text-muted">{item.modulesLabel}</p>}
        {grantSummary && <p className="text-xs text-accent-ink">Publié : {grantSummary}</p>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="grid content-start gap-2 rounded-lg bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 font-semibold"><Video className="size-4 text-accent" aria-hidden />Vidéo (lecture seule)</p>
          {status === "none" && <p className="text-muted">Pas encore de vidéo.</p>}
          {status === "ready" && <p>Prête{item.durationSec ? ` · ${formatDuration(item.durationSec)}` : ""} · <span className="text-muted">{item.videoName}</span></p>}
          {status === "processing" && <p className="text-amber-900">Cloudflare prépare la lecture (quelques minutes)… <span className="text-muted">{item.videoName}</span></p>}
          {status === "uploading" && item.source === "drive" && <p className="text-amber-900">Copie depuis Google Drive : {progress ?? (item.size ? Math.round(((item.offset ?? 0) / item.size) * 100) : 0)} %{item.size ? ` de ${formatBytes(item.size)}` : ""}. Vous pouvez quitter la page, la copie continue.</p>}
          {status === "uploading" && item.source === "upload" && busy !== "video" && <p className="text-amber-900">Envoi interrompu : renvoyez le fichier.</p>}
          {status === "error" && <p className="text-red-800">{item.videoError ?? "Erreur."}</p>}
          {busy === "video" && <p className="text-amber-900">Envoi : {progress ?? 0} % — gardez la page ouverte.</p>}
          {!streamReady ? (
            <p className="text-xs text-muted">Cloudflare Stream n&apos;est pas configuré.</p>
          ) : busy !== "video" && !(status === "uploading" && item.source === "drive") && status !== "processing" && (
            <div className="flex flex-wrap gap-2">
              <input ref={videoInput} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void sendVideo(f); }} />
              <button type="button" disabled={Boolean(busy)} onClick={() => videoInput.current?.click()} className={ghost}><CloudUpload className="size-4" aria-hidden />{status === "ready" ? "Remplacer (ordinateur)" : "Depuis mon ordinateur"}</button>
              <button type="button" disabled={Boolean(busy) || pending} onClick={() => (drive.open ? setDrive((d) => ({ ...d, open: false })) : searchDrive(""))} className={ghost}><HardDrive className="size-4" aria-hidden />{status === "ready" ? "Remplacer (Drive)" : "Depuis Google Drive"}</button>
              {status === "ready" && <button type="button" disabled={pending} onClick={() => run(async () => { await removeVideoAction({ itemId: item.id }); router.refresh(); })} className={ghost} aria-label="Supprimer la vidéo"><Trash2 className="size-4" aria-hidden /></button>}
            </div>
          )}
          {status === "ready" && <p className="text-xs text-muted">Remplacer la vidéo la remplace pour toutes les personnes qui y ont accès.</p>}
          {drive.open && (
            <div className="grid gap-2 rounded-lg border border-line bg-white p-2">
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); searchDrive(drive.search); }}>
                <input value={drive.search} onChange={(e) => setDrive((d) => ({ ...d, search: e.target.value }))} placeholder="Nom du fichier (vide = les plus récents)" className="min-w-0 flex-1 rounded-lg border border-line px-2 py-1 text-base" />
                <button className={ghost} disabled={pending}><Search className="size-4" aria-hidden />Chercher</button>
              </form>
              {drive.error && <p className="text-red-800">{drive.error}</p>}
              {drive.videos?.length === 0 && <p className="text-muted">Aucune vidéo trouvée.</p>}
              <ul className="grid max-h-64 gap-1 overflow-y-auto">
                {drive.videos?.map((v) => (
                  <li key={v.id}>
                    <button type="button" disabled={pending} onClick={() => run(async () => { const r = await startDriveAction({ itemId: item.id, fileId: v.id }); if (!r.ok) setError(r.error); else { setDrive((d) => ({ ...d, open: false })); router.refresh(); } })} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-50">
                      <span className="block truncate font-medium">{v.name}</span>
                      <span className="text-xs text-muted">{new Date(v.modifiedTime).toLocaleDateString("fr-FR")} · {formatBytes(v.size)}{v.durationSec ? ` · ${formatDuration(v.durationSec)}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="grid content-start gap-2 rounded-lg bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 font-semibold"><FileArchive className="size-4 text-accent" aria-hidden />Lab (ZIP, téléchargeable)</p>
          {item.labName ? <p>{item.labName}{item.labSize ? ` · ${formatBytes(item.labSize)}` : ""}</p> : <p className="text-muted">Pas de lab.</p>}
          {busy === "lab" && <p className="text-amber-900">Envoi du lab : {progress ?? 0} %</p>}
          <div className="flex flex-wrap gap-2">
            <input ref={labInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void sendLab(f); }} />
            <button type="button" disabled={Boolean(busy)} onClick={() => labInput.current?.click()} className={ghost}><FileArchive className="size-4" aria-hidden />{item.labName ? "Remplacer le ZIP" : "Ajouter un ZIP"}</button>
            {item.labName && <button type="button" disabled={pending} onClick={() => run(async () => { await removeLabAction({ itemId: item.id }); router.refresh(); })} className={ghost} aria-label="Retirer le lab"><Trash2 className="size-4" aria-hidden /></button>}
          </div>
        </div>
      </div>

      {publishable && (
        <div className="grid gap-2 rounded-lg border border-line p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`cohort-${item.id}`} className="font-semibold">Publier pour la cohorte</label>
            <select id={`cohort-${item.id}`} value={cohortId ?? ""} onChange={(e) => { setCohortId(Number(e.target.value) || null); setSelected([]); }} className="rounded-lg border border-line bg-white px-2 py-1">
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {cohort && item.daysByCohort[cohort.id] && <span className="text-xs text-muted">Dans son calendrier : {item.daysByCohort[cohort.id]}</span>}
          </div>
          {!cohort ? <p className="text-muted">Aucune cohorte de ce programme.</p> : cohort.people.length === 0 ? <p className="text-muted">Aucun inscrit payé dans cette cohorte.</p> : (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {cohort.people.map((p) => {
                const granted = grantedHere.includes(p.id);
                return (
                  <li key={p.id}><label className={`flex items-center gap-1.5 ${granted ? "text-muted" : ""}`}>
                    <input type="checkbox" disabled={granted} checked={granted || selected.includes(p.id)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id)))} />
                    {p.name}{granted ? " (accès donné)" : ""}
                  </label></li>
                );
              })}
            </ul>
          )}
          {notGranted.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={pending || selected.length === 0} onClick={() => publish(selected)} className={primary}><Send className="size-4" aria-hidden />Publier et prévenir ({selected.length})</button>
              <button type="button" disabled={pending} onClick={() => publish("all")} className={ghost}>Publier pour toute la cohorte ({notGranted.length})</button>
            </div>
          )}
        </div>
      )}

      {message && <p className="rounded-lg bg-accent-soft px-3 py-2 text-accent-ink">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}
    </div>
  );
}

const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold disabled:opacity-50";
const primary = "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50";
