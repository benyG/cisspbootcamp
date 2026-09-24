import type { Metadata } from "next";

import { ScannerWizard } from "@/components/scanner/ScannerWizard";
import { formatWhen } from "@/lib/booking";
import { readPendingSlot } from "@/lib/pending-slot";
import { loadScannerContext } from "@/lib/scanner/context";

export const metadata: Metadata = {
  title: "Êtes-vous prêt pour le CISSP ? — Analyse de profil",
  description:
    "11 questions, 3 minutes. Ben, coach CISSP, analyse votre profil et vous dit honnêtement où vous en êtes.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ScannerPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [context, pending] = await Promise.all([loadScannerContext(), readPendingSlot()]);
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const initialCountry = one("pays");
  const utm = {
    source: one("utm_source"),
    medium: one("utm_medium"),
    campaign: one("utm_campaign"),
    content: one("utm_content"),
    term: one("utm_term"),
  };

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
      <p className="mb-4 text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
        Analyse de profil CISSP
      </p>
      {pending && (
        <p className="mb-4 rounded-xl border border-accent/20 bg-accent-soft px-4 py-3 text-sm">
          <b>Créneau retenu : {formatWhen(new Date(pending.start), pending.timezone)}</b> ({pending.timezone}).{" "}
          {pending.kind === "discovery" ? "Validez votre profil en 3 minutes et le rendez-vous est confirmé." : "Validez votre profil en 3 minutes, puis le paiement confirme la séance."}
        </p>
      )}
      <ScannerWizard
        context={{ tiers: context.tiers, availabilityLabel: context.availabilityLabel }}
        utm={utm}
        initialCountry={initialCountry && /^[A-Z]{2}$/.test(initialCountry) ? initialCountry : undefined}
      />
    </main>
  );
}
