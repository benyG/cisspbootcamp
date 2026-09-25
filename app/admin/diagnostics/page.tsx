import Link from "next/link";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const READINESS_LABEL = {
  ready: "Éligible",
  conditional: "Associate",
  not_yet: "Fondations (CC)",
} as const;

/** Diagnoses waiting for Ben, oldest first: the promise is 24 hours. */
export default async function DiagnosticsPage() {
  const pending = await prisma.scannerResponse.findMany({
    where: { status: "pending_review" },
    orderBy: { createdAt: "asc" },
    include: { lead: { select: { firstName: true, lastName: true, country: true, tier: true } } },
  });

  const now = Date.now();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Messages de relance à valider</h1>
        <span className="text-sm text-[var(--color-muted)]">{pending.length} en attente</span>
      </div>

      {pending.length === 0 ? (
        <p className="mt-8 text-[var(--color-muted)]">Rien à valider. Tout est parti.</p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {pending.map((item) => {
            const hours = Math.floor((now - item.createdAt.getTime()) / 3_600_000);
            const late = hours >= 24;
            return (
              <li key={item.id}>
                <Link
                  href={`/admin/diagnostics/${item.id}`}
                  className={[
                    "flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5",
                    late ? "border-red-300 bg-red-50" : "border-slate-200 bg-white",
                  ].join(" ")}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {item.lead.firstName} {item.lead.lastName}
                    </p>
                    <p className="text-sm text-[var(--color-muted)]">
                      {item.lead.country} · {READINESS_LABEL[item.readiness]} ·{" "}
                      {late ? `en attente depuis ${hours} h` : `il y a ${hours} h`}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-sm font-bold text-white"
                    style={{ background: heatColor(item.heatScore) }}
                    title="Chaleur commerciale"
                  >
                    {item.heatScore}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

function heatColor(score: number): string {
  if (score >= 60) return "#b91c1c";
  if (score >= 30) return "#c2410c";
  return "#64748b";
}
