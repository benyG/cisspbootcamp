import { notFound } from "next/navigation";

import type { ProfileAnalysis } from "@/lib/analysis";
import { prospectAxes } from "@/lib/analysis";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * The prospect's result page. Reachable only once Ben has approved the
 * diagnosis: before that the token exists but answers 404, so a leaked link
 * shows nothing.
 */
export default async function ScannerResultPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const response = await prisma.scannerResponse.findUnique({
    where: { resultToken: token },
    include: { lead: { select: { firstName: true } } },
  });

  if (!response || response.status === "pending_review" || response.status === "set_aside") {
    notFound();
  }

  const analysis = response.analysis as unknown as ProfileAnalysis;
  const axes = prospectAxes(analysis.axes);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-10">
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
        Votre analyse CISSP
      </p>
      <h1 className="mt-2 text-3xl font-bold text-balance">{analysis.headline}</h1>

      <dl className="mt-8 flex flex-col gap-5">
        {axes.map((axis) => (
          <div key={axis.key}>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-medium">{axis.label}</dt>
              <dd className="text-sm text-[var(--color-muted)]">{axis.detail}</dd>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[var(--color-accent)]"
                style={{ width: `${Math.max(6, axis.score)}%` }}
              />
            </div>
          </div>
        ))}
      </dl>

      <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-semibold text-[var(--color-accent)] uppercase">
          Délai réaliste jusqu&apos;à l&apos;examen
        </p>
        <p className="mt-1 text-2xl font-bold">{analysis.timeline.label} avec accompagnement</p>
        <p className="text-[var(--color-muted)]">
          {analysis.timeline.soloLabel} seul, d&apos;après ce que Ben observe.
        </p>
      </div>

      <article className="mt-8 whitespace-pre-line text-lg leading-relaxed">
        {response.coachMessage}
      </article>

      {analysis.recommendation !== "build_first" && (
        <a
          href={`/rdv?t=${token}`}
          className="mt-8 block rounded-lg bg-[var(--color-accent)] px-5 py-4 text-center text-lg font-semibold text-white"
        >
          Réserver 15 minutes avec Ben
        </a>
      )}
    </main>
  );
}
