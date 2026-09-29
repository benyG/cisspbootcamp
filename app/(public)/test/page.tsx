import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PracticeTestBox } from "@/components/examboot/PracticeTestBox";
import { TrackView } from "@/components/tracking/TrackView";
import { examBootEnabled } from "@/lib/examboot/client";
import { POST_CODE_PATTERN } from "@/lib/marketing/plan";

export const metadata: Metadata = {
  title: "Testez votre raisonnement CISSP — 5 questions d’entraînement",
  description: "Cinq questions d’entraînement originales, au niveau et dans l’esprit du CISSP, corrigées. Sans compte, en dix minutes.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/**
 * Where a "Testez-vous" post lands (Ben, 29/09): the practice test first,
 * then the profile analysis, with the post's tracking carried along so the
 * library credits the post for both.
 */
export default async function TestPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const utm = new URLSearchParams();
  for (const key of UTM_KEYS) {
    const value = params[key];
    const one = Array.isArray(value) ? value[0] : value;
    if (one) utm.set(key, one.slice(0, 120));
  }
  const scannerHref = `/scanner${utm.size ? `?${utm}` : ""}`;
  if (!examBootEnabled()) redirect(scannerHref);
  const content = utm.get("utm_content");
  const campaignCode = content && POST_CODE_PATTERN.test(content) ? content : undefined;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 py-8">
      <TrackView name="test_page_view" label={campaignCode} />
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">Test gratuit · 10 minutes</p>
      <h1 className="display text-3xl font-black text-balance">Raisonnez-vous comme un manager sécurité ?</h1>
      <p className="text-lg text-[var(--color-muted)]">
        Le CISSP ne teste pas ce que vous savez, mais comment vous décidez. Cinq questions d’entraînement, corrigées, pour le voir par vous-même.
      </p>
      <PracticeTestBox
        placement="post"
        campaignCode={campaignCode}
        title="Testez votre raisonnement CISSP"
        text="Cinq questions d’entraînement originales, conçues au niveau et dans l’esprit du CISSP, corrigées à la fin. Sans compte. Votre score s’affiche ici."
      />
      <section className="rounded-[18px] border border-line bg-white p-5">
        <div className="text-[.72rem] font-extrabold tracking-[.1em] text-accent uppercase">Étape suivante</div>
        <h2 className="display mt-1 text-[1.3rem] leading-tight font-black">Votre analyse de profil, en 3 minutes</h2>
        <p className="mt-2 text-[.95rem] text-[var(--color-muted)]">
          Le test montre comment vous raisonnez. L’analyse dit si vous êtes éligible, en combien de temps viser l’examen, et par quelle voie. Votre score la complète.
        </p>
        <Link href={scannerHref} className="mt-4 inline-flex items-center justify-center rounded-[14px] bg-accent px-5 py-3.5 font-extrabold text-white">
          Analyser mon profil →
        </Link>
      </section>
    </main>
  );
}
