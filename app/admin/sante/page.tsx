import { Stethoscope } from "lucide-react";
import Link from "next/link";

import { HealthPanel } from "@/components/admin/health/HealthPanel";
import { CHECKS } from "@/lib/health/checks";

import { runHealthChecks, sendTestEmail } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Santé des intégrations (Ben, 09/11): every outside service tested in one
 * click, read-only, with what to do when one fails. Secrets never shown.
 */
export default function HealthPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Stethoscope className="size-6 shrink-0 text-accent" aria-hidden />Santé des intégrations</h1>
      <p className="mt-1 text-sm text-muted">Un clic teste les {CHECKS.length} services dont le site dépend : agenda, e-mails, paiements, IA, LinkedIn, stockage, vidéos, tâches automatiques. Les tests ne publient, n’envoient et ne facturent rien. Une panne affiche ce qu’il faut faire pour la corriger.</p>
      <HealthPanel run={runHealthChecks} testEmail={sendTestEmail} />
      <p className="mt-6 text-xs text-muted">Pas utilisés aujourd’hui, donc non testés : DataForSEO, Google Search Console, les statistiques LinkedIn et Meta Ads. Ils s’ajouteront ici quand ils seront branchés.</p>
    </main>
  );
}
