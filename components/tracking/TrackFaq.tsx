"use client";

import type { ReactNode } from "react";

import { track } from "@/lib/tracking/client";

/** A FAQ entry that records which question was opened — the objections list of the tunnel report. */
export function TrackFaq({ question, className, children }: { question: string; className?: string; children: ReactNode }) {
  return (
    <details className={className} onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) track("faq_open", { label: question }); }}>
      {children}
    </details>
  );
}
