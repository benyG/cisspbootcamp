import Link from "next/link";
import { notFound } from "next/navigation";

import type { ProfileAnalysis } from "@/lib/analysis";
import { prisma } from "@/lib/db";
import { formatUsdCents } from "@/lib/pricing";
import { CERTIFICATION_LABELS, DOMAIN_LABELS } from "@/lib/scanner/questions";
import type { ScannerAnswers } from "@/lib/scoring";

import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

const READINESS_LABEL = {
  ready: "Éligible",
  conditional: "Associate",
  not_yet: "Fondations (CC)",
} as const;

/**
 * The review screen. Everything Ben needs to approve in ten seconds sits
 * above the fold: who, how hot, the bars, the timeline, the message.
 */
export default async function DiagnosisReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const response = await prisma.scannerResponse.findUnique({
    where: { id: Number(id) },
    include: { lead: { include: { pricingTier: true } } },
  });
  if (!response) notFound();

  const analysis = response.analysis as unknown as ProfileAnalysis;
  const answers = response.answers as unknown as ScannerAnswers;
  const { lead } = response;
  const isPending = response.status === "pending_review";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin/diagnostics" className="text-sm text-[var(--color-muted)]">
        ← Diagnostics
      </Link>

      <header className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {lead.firstName} {lead.lastName}
          </h1>
          <p className="text-[var(--color-muted)]">
            {lead.country} · {lead.pricingTier.label} ·{" "}
            {lead.pricingTier.amountUsd > 0 ? formatUsdCents(lead.pricingTier.amountUsd) : "sur devis"}
            {lead.jobTitle ? ` · ${lead.jobTitle}` : ""}
          </p>
          <p className="mt-1 text-sm">
            <a href={`mailto:${lead.email}`} className="underline">{lead.email}</a>
            {lead.whatsapp && (
              <>
                {" · "}
                <a href={`https://wa.me/${lead.whatsapp.replace("+", "")}`} className="underline">
                  WhatsApp
                </a>
              </>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-4xl font-black" style={{ color: analysis.heatScore >= 60 ? "#b91c1c" : "#0f172a" }}>
            {analysis.heatScore}
          </p>
          <p className="text-xs text-[var(--color-muted)]">chaleur / 100</p>
        </div>
      </header>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-lg font-bold">{READINESS_LABEL[analysis.readiness]}</p>
        <p className="text-[var(--color-muted)]">{analysis.headline}</p>

        <dl className="mt-4 flex flex-col gap-3">
          {analysis.axes.map((axis) => (
            <div key={axis.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <dt className="font-medium">
                  {axis.label}
                  {axis.audience === "coach" && (
                    <span className="ml-2 text-xs text-[var(--color-muted)]">(vous seul)</span>
                  )}
                </dt>
                <dd className="text-[var(--color-muted)]">{axis.detail}</dd>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)]"
                  style={{ width: `${Math.max(3, axis.score)}%` }}
                />
              </div>
            </div>
          ))}
        </dl>

        <p className="mt-4 text-sm">
          <strong>Délai :</strong> {analysis.timeline.label} accompagné, {analysis.timeline.soloLabel} seul
          {analysis.goalIsTight && (
            <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
              objectif plus serré
            </span>
          )}
        </p>
      </section>

      {lead.goals && (
        <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold tracking-wide text-[var(--color-muted)] uppercase">
            Ses objectifs, dans ses mots
          </p>
          <p className="mt-1 whitespace-pre-line">{lead.goals}</p>
        </section>
      )}

      <details className="mt-4 rounded-xl border border-slate-200 p-4 text-sm">
        <summary className="cursor-pointer font-medium">Réponses détaillées</summary>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <dt className="text-[var(--color-muted)]">Situation</dt><dd>{answers.professionalStatus}</dd>
          <dt className="text-[var(--color-muted)]">Expérience</dt><dd>{answers.experience}</dd>
          <dt className="text-[var(--color-muted)]">Diplôme 4 ans</dt><dd>{answers.hasFourYearDegree ? "oui" : "non"}</dd>
          <dt className="text-[var(--color-muted)]">Certifications</dt>
          <dd>{answers.certifications.map((c) => CERTIFICATION_LABELS[c]).join(", ") || "aucune"}</dd>
          <dt className="text-[var(--color-muted)]">Domaines</dt>
          <dd>{answers.domains.map((d) => DOMAIN_LABELS[d]).join(", ") || "aucun"}</dd>
          <dt className="text-[var(--color-muted)]">Anglais</dt><dd>{answers.englishReading} / 5</dd>
          <dt className="text-[var(--color-muted)]">Examen</dt><dd>{answers.examAttempt}</dd>
          <dt className="text-[var(--color-muted)]">Objectif</dt><dd>{answers.examGoal}</dd>
          <dt className="text-[var(--color-muted)]">Budget</dt><dd>{answers.budget}</dd>
          <dt className="text-[var(--color-muted)]">Disponibilité</dt><dd>{answers.cohortAvailability}</dd>
        </dl>
      </details>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Message de relance</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Le prospect a déjà son résultat à l&apos;écran et par e-mail. Ce message-ci est l&apos;argumentaire, rédigé par l&apos;IA à partir de son profil : relisez, corrigez, validez. Rien ne part sans ce clic.
        </p>
        {isPending ? (
          <ReviewForm id={response.id} initialMessage={response.coachMessage} />
        ) : (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold">
              {response.status === "sent" && `Envoyé le ${response.sentAt?.toLocaleString("fr-FR")}`}
              {response.status === "approved" && "Validé — e-mail non parti, page de résultat en ligne"}
              {response.status === "set_aside" && "Mis de côté"}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm">{response.coachMessage}</p>
          </div>
        )}
      </section>
    </main>
  );
}
