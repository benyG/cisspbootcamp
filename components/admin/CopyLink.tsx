"use client";

import { useState } from "react";

/** A link to copy in one tap (the ad's tracked link). */
export function CopyLink({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="flex min-w-0 items-center gap-2">
      <input readOnly value={value} onFocus={(e) => e.currentTarget.select()} aria-label="Lien suivi" className="min-w-0 flex-1 truncate rounded-lg border border-line bg-slate-50 px-2.5 py-1.5 font-mono text-xs" />
      <button
        type="button"
        onClick={() => { void navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
        className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold"
      >
        {copied ? "Copié" : "Copier"}
      </button>
    </span>
  );
}
