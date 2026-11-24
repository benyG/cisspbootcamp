"use client";

import { Printer } from "lucide-react";

/** The browser's print dialog: « Enregistrer au format PDF » gives the file. */
export function PrintButton({ label = "Imprimer ou PDF" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white print:hidden">
      <Printer className="size-4" aria-hidden />{label}
    </button>
  );
}
