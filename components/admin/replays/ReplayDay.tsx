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
} from "@/app/admin/cohortes/[id]/replays/actions";
import type { DriveVideo } from "@/lib/drive";
import { formatBytes, formatDuration } from "@/lib/replays";

export type ReplayRow = {
  id: number | null;
  videoStatus: string;
  videoName: string | null;
  videoError: string | null;
  durationSec: number | null;
  source: string | null;
  size: number | null;
  offset: number | null;
  labName: string | null;
  labSize: number | null;
  grantedIds: number[];
};
type Person = { id: number; name: string };

const CHUNK = 50 * 1024 * 1024; // multiple of 256 KiB, as Cloudflare asks

/**
 * One day of the cohort in the replays admin (Ben, 12/10): its recording
 * (from the computer, in resumable pieces straight to Cloudflare, or copied
 * from Google Drive by the server), its lab ZIP, and who it is published to.
 */
export function ReplayDay({ cohortId, day, title, date, row, people, streamReady }: { cohortId: number; day: number; title: string; date: string; row: ReplayRow; people: Person[]; streamReady: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [drive, setDrive] = useState<{ open: boolean; search: string; videos: DriveVideo[] | null; error: string | null }>({ open: false, search: "", videos: null, error: null });
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, run] = useTransition();
  const videoInput = useRef<HTMLInputElement>(null);
  const labInput = useRef<HTMLInputElement>(null);

  // Keeps a Drive copy going while the page is open (the cron takes over otherwise).
  useEffect(() => {
    if (row.id === null || row.videoStatus !== "uploading" || row.source !== "drive") return;
    let stop = false;
    (async () => {
      while (!stop) {
        const r = await driveStepAction({ replayId: row.id! }).catch(() => null);
        if (!r || stop) break;
        if (r.size) setProgress(Math.round((r.offset / r.size) * 100));
        if (r.status !== "uploading") { router.refresh(); break; }
        if (r.error) { setError(r.error); await new Promise((res) => setTimeout(res, 15_000)); }
      }
    })();
    return () => { stop = true; };
  }, [row.id, row.videoStatus, row.source, router]);

  // While Cloudflare prepares the video, ask every 20 seconds.
  useEffect(() => {
    if (row.id === null || row.videoStatus !== "processing") return;
    const timer = window.setInterval(() => { checkVideoAction({ cohortId, replayId: row.id! }).then((changed) => changed && router.refresh()).catch(() => undefined); }, 20_000);
    return () => window.clearInterval(timer);
  }, [row.id, row.videoStatus, cohortId, router]);

  const sendVideo = async (file: File) => {
    setError(null); setBusy("video"); setProgress(0);
    try {
      const start = await startUploadAction({ cohortId, day, name: file.name, size: file.size });
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
      await finishUploadAction({ cohortId, replayId: start.replayId });
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
      const blob = await upload(`replays/labs/${cohortId}/J${day}-${safe}`, file, {
        access: "private",
        handleUploadUrl: "/api/admin/replays/lab",
        contentType: file.type || "application/zip",
        multipart: file.size > 8 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      const r = await attachLabAction({ cohortId, day, pathname: blob.pathname, name: file.name });
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
    setError(null);
    const r = await publishAction({ cohortId, day, leadIds });
    if (r.ok) { setMessage(r.message); setSelected([]); router.refresh(); } else setError(r.error);
  });

  const status = row.videoStatus;
  const publishable = status === "ready" || (status === "none" && row.labName);
  const notGranted = people.filter((p) => !row.grantedIds.includes(p.id));

  return (
    <li className="grid gap-3 rounded-xl border border-line bg-white p-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold"><span className="font-extrabold">J{day}</span> · {date} · {title}</h2>
        {row.grantedIds.length > 0 && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-ink">Publié pour {row.grantedIds.length}</span>}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {/* Video */}
        <div className="grid content-start gap-2 rounded-lg bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 font-semibold"><Video className="size-4 text-accent" aria-hidden />Enregistrement</p>
          {status === "ready" && <p>Prêt · {row.durationSec ? formatDuration(row.durationSec) : ""} · <span className="text-muted">{row.videoName}</span></p>}
          {status === "processing" && <p className="text-amber-900">Cloudflare prépare la lecture (quelques minutes)… <span className="text-muted">{row.videoName}</span></p>}
          {status === "uploading" && row.source === "drive" && <p className="text-amber-900">Copie depuis Google Drive : {progress ?? (row.size ? Math.round(((row.offset ?? 0) / row.size) * 100) : 0)} %{row.size ? ` de ${formatBytes(row.size)}` : ""}. Vous pouvez quitter la page, la copie continue.</p>}
          {status === "uploading" && row.source === "upload" && busy !== "video" && <p className="text-amber-900">Envoi interrompu : renvoyez le fichier.</p>}
          {status === "error" && <p className="text-red-800">{row.videoError ?? "Erreur."}</p>}
          {busy === "video" && <p className="text-amber-900">Envoi : {progress ?? 0} % — gardez la page ouverte.</p>}
          {!streamReady ? (
            <p className="text-xs text-muted">Cloudflare Stream n&apos;est pas configuré.</p>
          ) : busy !== "video" && !(status === "uploading" && row.source === "drive") && status !== "processing" && (
            <div className="flex flex-wrap gap-2">
              <input ref={videoInput} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void sendVideo(f); }} />
              <button type="button" disabled={Boolean(busy)} onClick={() => videoInput.current?.click()} className={ghost}><CloudUpload className="size-4" aria-hidden />{status === "ready" ? "Remplacer (ordinateur)" : "Depuis mon ordinateur"}</button>
              <button type="button" disabled={Boolean(busy) || pending} onClick={() => (drive.open ? setDrive((d) => ({ ...d, open: false })) : searchDrive(""))} className={ghost}><HardDrive className="size-4" aria-hidden />{status === "ready" ? "Remplacer (Drive)" : "Depuis Google Drive"}</button>
              {status === "ready" && <button type="button" disabled={pending} onClick={() => run(async () => { await removeVideoAction({ cohortId, day }); router.refresh(); })} className={ghost} aria-label="Supprimer la vidéo"><Trash2 className="size-4" aria-hidden /></button>}
            </div>
          )}
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
                    <button type="button" disabled={pending} onClick={() => run(async () => { const r = await startDriveAction({ cohortId, day, fileId: v.id }); if (!r.ok) setError(r.error); else { setDrive((d) => ({ ...d, open: false })); router.refresh(); } })} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-slate-50">
                      <span className="block truncate font-medium">{v.name}</span>
                      <span className="text-xs text-muted">{new Date(v.modifiedTime).toLocaleDateString("fr-FR")} · {formatBytes(v.size)}{v.durationSec ? ` · ${formatDuration(v.durationSec)}` : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Lab */}
        <div className="grid content-start gap-2 rounded-lg bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 font-semibold"><FileArchive className="size-4 text-accent" aria-hidden />Lab (ZIP, téléchargeable)</p>
          {row.labName ? <p>{row.labName}{row.labSize ? ` · ${formatBytes(row.labSize)}` : ""}</p> : <p className="text-muted">Pas de lab.</p>}
          {busy === "lab" && <p className="text-amber-900">Envoi du lab : {progress ?? 0} %</p>}
          <div className="flex flex-wrap gap-2">
            <input ref={labInput} type="file" accept=".zip,application/zip" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void sendLab(f); }} />
            <button type="button" disabled={Boolean(busy)} onClick={() => labInput.current?.click()} className={ghost}><FileArchive className="size-4" aria-hidden />{row.labName ? "Remplacer le ZIP" : "Ajouter un ZIP"}</button>
            {row.labName && <button type="button" disabled={pending} onClick={() => run(async () => { await removeLabAction({ cohortId, day }); router.refresh(); })} className={ghost} aria-label="Retirer le lab"><Trash2 className="size-4" aria-hidden /></button>}
          </div>
        </div>
      </div>

      {/* Publication */}
      {publishable && (
        <div className="grid gap-2 rounded-lg border border-line p-3">
          <p className="font-semibold">Publier pour</p>
          {people.length === 0 ? <p className="text-muted">Aucun inscrit payé.</p> : (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {people.map((p) => {
                const granted = row.grantedIds.includes(p.id);
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
              <button type="button" disabled={pending} onClick={() => publish("all")} className={ghost}>Publier pour tous ({notGranted.length})</button>
            </div>
          )}
        </div>
      )}

      {message && <p className="rounded-lg bg-accent-soft px-3 py-2 text-accent-ink">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>}
    </li>
  );
}

const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold disabled:opacity-50";
const primary = "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50";
