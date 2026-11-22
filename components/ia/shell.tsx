import { Bot } from "lucide-react";
import Link from "next/link";

import { shell } from "@/components/landing/sections";
import { iaPath } from "@/lib/ia-domain";
import { IA_COMPANY } from "@/lib/ia-brand";

/**
 * Bâtisseur IA has its own header: it is not the CISSP site. Two offers
 * (Ben, 22/11): the training and the support for companies, side by side.
 */
export function IaTopbar({ current = "formation" }: { current?: "formation" | "entreprises" }) {
  const tab = (on: boolean) => "px-3 py-2 text-[.86rem] font-bold " + (on ? "bg-ink text-white" : "bg-white text-ink");
  return (
    <header className={shell}>
      <div className="flex flex-wrap items-center justify-between gap-3 py-5">
        <Link href={iaPath("/ia")} className="flex items-center gap-2 text-[1.4rem] font-extrabold uppercase [font-family:var(--font-ia-display),var(--font-inter-tight),sans-serif]">
          <span className="grid size-[30px] place-items-center rounded-lg bg-ink text-white"><Bot className="size-[18px]" aria-hidden /></span>
          Bâtisseur <span className="text-[#0B6E56]">IA</span>
        </Link>
        <nav aria-label="Nos offres" className="inline-flex overflow-hidden rounded-[10px] border-2 border-ink">
          <Link href={iaPath("/ia")} className={tab(current === "formation")} aria-current={current === "formation" ? "page" : undefined}>Formation</Link>
          <Link href={iaPath("/ia/entreprises")} className={tab(current === "entreprises")} aria-current={current === "entreprises" ? "page" : undefined}>Entreprises</Link>
        </nav>
      </div>
    </header>
  );
}

export function IaFooter() {
  return (
    <footer className="border-t border-line py-7 pb-12 text-[.86rem] text-muted">
      <div className={shell + " flex flex-wrap justify-between gap-x-6 gap-y-3.5"}>
        <span>Bâtisseur IA · {IA_COMPANY}, en français</span>
        <span className="flex flex-wrap gap-x-3">
          <Link href={iaPath("/ia")} className="underline underline-offset-4">La formation</Link>
          <Link href={iaPath("/ia/entreprises")} className="underline underline-offset-4">Entreprises</Link>
          <Link href={iaPath("/ia/diagnostic")} className="underline underline-offset-4">Diagnostic</Link>
          <Link href="/confidentialite" className="underline underline-offset-4">Confidentialité</Link>
        </span>
      </div>
    </footer>
  );
}
