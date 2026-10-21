import { FileText } from "lucide-react";
import Link from "next/link";

import { OfferEditor } from "@/components/admin/offer/OfferEditor";
import { prisma } from "@/lib/db";
import { draftOffer, offerSchema } from "@/lib/offer";
import { countryLabel } from "@/lib/quotes";
import { loadSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/**
 * The service offer issued by ExamBoot (Ben, 21/10): from a quote request
 * (?id=) or blank for a company Ben approaches himself.
 */
export default async function OfferPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const sp = await searchParams;
  const [settings, quote] = await Promise.all([loadSiteSettings(), sp.id ? prisma.quoteRequest.findUnique({ where: { id: Number(sp.id) || 0 } }) : null]);
  const saved = quote?.offer ? offerSchema.safeParse(quote.offer) : null;
  const offer = saved?.success ? saved.data : draftOffer({ quote, countryLabel, paymentTerms: settings.company.paymentTerms, today: new Date() });
  const c = settings.company;
  const missing = [!c.legalForm && "forme juridique", !c.registration && "immatriculation", !c.address && "adresse", !c.email && "e-mail"].filter(Boolean);
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 print:p-0">
      <div className="print:hidden">
        <Link href={quote ? `/admin/devis?id=${quote.id}` : "/admin/devis"} className="text-sm text-muted">← Devis entreprises</Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><FileText className="size-6 text-accent" aria-hidden />Offre de service {c.name}{quote ? ` · ${quote.organization}` : ""}</h1>
        <p className="mt-1 text-sm text-muted">Complétez à gauche, vérifiez à droite, puis « Imprimer ou PDF ». {quote ? "« Enregistrer » garde l'offre avec la demande." : "Offre libre : rien n'est enregistré, imprimez-la directement."}</p>
        {missing.length > 0 && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Identité de {c.name} incomplète ({missing.join(", ")}) : complétez-la dans <Link href="/admin/parametres/site" className="underline">Page d&apos;accueil › Entreprise émettrice</Link>. Ces informations apparaissent en en-tête et en pied de page.</p>}
      </div>
      <div className="mt-5 print:mt-0">
        <OfferEditor initial={offer} quoteId={quote?.id ?? null} ctx={{ company: c, coach: settings.coach, steps: settings.method.steps, included: settings.offer.included }} />
      </div>
    </main>
  );
}
