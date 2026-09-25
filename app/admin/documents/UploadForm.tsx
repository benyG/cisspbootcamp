"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { ALLOWED_MIME_TYPES, MAX_FILE_BYTES, blobPathnameFor, formatBytes, validateUpload } from "@/lib/documents";

import { registerDocument } from "./actions";

type Props = { programs: Array<{ code: string; name: string }> };

/**
 * The browser sends the file directly to private storage, with a progress
 * bar, then the server records it. Up to 30 MB per file (Ben, 25/09).
 */
export function UploadForm({ programs }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [program, setProgram] = useState(programs[0]?.code ?? "cissp");
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    setMessage(null);
    if (!file || name.trim().length < 2) return setMessage({ ok: false, text: "Nom et fichier sont requis." });
    const error = validateUpload({ size: file.size, mimeType: file.type, filename: file.name });
    if (error) return setMessage({ ok: false, text: error });

    startTransition(async () => {
      try {
        setProgress(0);
        const random = crypto.randomUUID().slice(0, 12);
        const blob = await upload(blobPathnameFor(program, file.name, random), file, {
          access: "private",
          handleUploadUrl: "/api/admin/documents/upload",
          contentType: file.type,
          multipart: file.size > 8 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        });
        const result = await registerDocument({ name: name.trim(), program: program as "cissp" | "cc", filename: file.name, pathname: blob.pathname });
        if (!result.ok) {
          setMessage({ ok: false, text: result.error });
        } else {
          setMessage({ ok: true, text: "Document ajouté." });
          setName("");
          if (fileRef.current) fileRef.current.value = "";
          router.refresh();
        }
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? `Envoi interrompu : ${e.message}` : "Envoi interrompu." });
      } finally {
        setProgress(null);
      }
    });
  };

  return (
    <form onSubmit={submit} className="mt-5 grid gap-3 rounded-xl border border-line bg-white p-4">
      <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Nom affiché dans l&apos;e-mail</span><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Programme des 15 jours" className={input} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Formation</span>
          <select value={program} onChange={(e) => setProgram(e.target.value)} className={input}>{programs.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
        <label className="flex flex-col gap-1 text-sm"><span className="font-medium">Fichier ({formatBytes(MAX_FILE_BYTES)} max)</span><input ref={fileRef} type="file" required accept={Object.values(ALLOWED_MIME_TYPES).map((x) => `.${x}`).concat(".jpeg").join(",")} className="text-sm" /></label>
      </div>
      {progress !== null && (
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {message && <p className={"rounded-lg px-3 py-2 text-sm " + (message.ok ? "bg-accent-soft" : "bg-red-50 text-red-800")}>{message.text}</p>}
      <div className="flex justify-end"><button disabled={pending} className="rounded-lg bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50">{pending ? (progress !== null ? `Envoi… ${progress} %` : "Enregistrement…") : "Ajouter"}</button></div>
    </form>
  );
}

const input = "rounded-lg border border-line px-3 py-2 text-base";
