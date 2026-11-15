import { Rocket } from "lucide-react";
import Link from "next/link";

import { CampaignWizard } from "@/components/admin/campaign/CampaignWizard";
import { COHORT_STATUS_LABEL, MANUAL_COHORT_STATUSES } from "@/lib/cohorts";
import { PROGRAMS } from "@/lib/programs";

import { createCohort } from "../actions";

export const dynamic = "force-dynamic";

/**
 * "Lancer une cohorte" (lot 5): the cohort, its goal, promo and channels,
 * and the dated campaign plan. For the Bâtisseur IA, the form opens an
 * entry: a J1 date with its goal and campaign (Ben, 15/11).
 */
export default async function NewCohortPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  // Bâtisseur IA: an entry runs eight weeks from its J1 (lib/ia-days-server.ts).
  const programs = (["cissp", "cc", "ia"] as const).map((code) => ({ code, name: PROGRAMS[code].name, days: code === "ia" ? 56 : PROGRAMS[code].days }));
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
      <Link href="/admin/cohortes" className="text-sm text-muted">← Cohortes</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Rocket className="size-6 shrink-0 text-accent" aria-hidden />Lancer une cohorte</h1>
      <p className="mt-1 text-sm text-muted">Le plan se calcule pendant que vous remplissez.</p>
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}
      <div className="mt-5">
        <CampaignWizard
          mode="create"
          action={createCohort}
          programs={programs}
          statuses={MANUAL_COHORT_STATUSES.map((value) => ({ value, label: COHORT_STATUS_LABEL[value]! }))}
          initial={{ program: "cissp", name: "", startsAt: "", endsAt: "", capacity: 10, targetSeats: "", status: "planned" }}
        />
      </div>
    </main>
  );
}
