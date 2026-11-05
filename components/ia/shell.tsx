import { Bot } from "lucide-react";
import Link from "next/link";

import { shell } from "@/components/landing/sections";
import { iaPath } from "@/lib/ia-domain";

/** Bâtisseur IA has its own header: it is not the CISSP site (a separate domain later). */
export function IaTopbar() {
  return (
    <header className={shell}>
      <div className="flex items-center justify-between py-5">
        <Link href={iaPath("/ia")} className="flex items-center gap-2 text-[1.4rem] font-extrabold uppercase [font-family:var(--font-ia-display),var(--font-inter-tight),sans-serif]">
          <span className="grid size-[30px] place-items-center rounded-lg bg-ink text-white"><Bot className="size-[18px]" aria-hidden /></span>
          Bâtisseur <span className="text-[#0B6E56]">IA</span>
        </Link>
        <Link href={iaPath("/ia/diagnostic")} className="inline-flex items-center rounded-full border border-line bg-white px-4 py-2.5 text-[.92rem] font-bold">Diagnostic gratuit</Link>
      </div>
    </header>
  );
}

export function IaFooter({ coach }: { coach: string }) {
  return (
    <footer className="border-t border-line py-7 pb-12 text-[.86rem] text-muted">
      <div className={shell + " flex flex-wrap justify-between gap-x-6 gap-y-3.5"}>
        <span>Bâtisseur IA · Formation en français · {coach}</span>
        <span className="flex flex-wrap gap-x-3">
          <Link href={iaPath("/ia")} className="underline underline-offset-4">Le programme</Link>
          <Link href={iaPath("/ia/diagnostic")} className="underline underline-offset-4">Diagnostic</Link>
          <Link href="/confidentialite" className="underline underline-offset-4">Confidentialité</Link>
        </span>
      </div>
    </footer>
  );
}
