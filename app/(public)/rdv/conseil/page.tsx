import type { Metadata } from "next";
import Link from "next/link";

import { ServiceCards } from "@/components/consulting/ServiceCards";
import { Footer, Topbar, eyebrow, shell } from "@/components/landing/sections";
import { TrackView } from "@/components/tracking/TrackView";
import { formatWhen } from "@/lib/booking";
import { loadServices } from "@/lib/consulting";
import { prisma } from "@/lib/db";
import { readPendingSlot } from "@/lib/pending-slot";
import { loadRates } from "@/lib/registration";
import { groupByFormat, servicesInFormat } from "@/lib/services";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = { title: "Choisir sa séance de conseil — CISSP Bootcamp" };
export const dynamic = "force-dynamic";

/**
 * Step 3 of the paid path (Ben, 24/09): the slot is kept, now the palette of
 * services for that format, with prices by country. Nothing before this
 * point mentions a price.
 */
export default async function ConsultingPalettePage({ searchParams }: { searchParams: Promise<{ t?: string; erreur?: string }> }) {
  const { t, erreur } = await searchParams;
  const pending = await readPendingSlot();
  const held = pending?.kind === "consulting" && pending.format ? pending : null;
  const [settings, services, tiers, rates] = await Promise.all([
    loadSiteSettings().catch(() => SITE_DEFAULTS),
    loadServices().catch(() => []),
    prisma.pricingTier.findMany({ select: { code: true, countries: true } }).catch(() => []),
    loadRates().catch(() => ({})),
  ]);
  const format = held ? groupByFormat(services).find((f) => f.key === held.format) ?? null : null;
  const palette = held ? servicesInFormat(services, held.format as string) : [];
  const tokenParam = t ? `&t=${encodeURIComponent(t)}` : "";

  return (
    <>
      <TrackView name="service_view" label="palette" />
      <Topbar />
      <main className={shell + " pb-16 sm:pb-20"}>
        <div className="max-w-[820px] pt-4 sm:pt-8">
          <Link href={`/rdv?type=approfondie${tokenParam}`} className="text-sm text-muted">← Changer de durée ou de créneau</Link>
          <div className={eyebrow + " mt-4"}>Consultation approfondie · 3. La séance</div>
          <h1 className="display mt-3 text-[clamp(1.9rem,4vw,3rem)] leading-[1] font-black tracking-[-.04em]">
            {held ? "Votre créneau est retenu. Quelle séance ?" : "Commencez par choisir un créneau."}
          </h1>
          {held && format && (
            <p className="mt-3 rounded-[14px] border border-accent/20 bg-accent-soft px-4 py-3 text-sm">
              <b>Créneau retenu : {formatWhen(new Date(held.start), held.timezone)}</b> ({held.timezone}) · format {format.label}. Choisissez la séance, puis {t ? "le paiement la confirme." : "3 minutes d’analyse de profil, et le paiement la confirme."}
            </p>
          )}
          {erreur && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}
        </div>

        <div className="mt-8">
          {!held ? (
            <Link href={`/rdv?type=approfondie${tokenParam}`} className="inline-flex rounded-[14px] bg-ink px-5 py-3.5 font-extrabold text-white">Choisir la durée et le créneau →</Link>
          ) : palette.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">Aucune séance de ce format n’est ouverte pour le moment.</p>
          ) : (
            <ServiceCards
              services={palette}
              tiers={tiers.map((tier) => ({ code: tier.code, countries: Array.isArray(tier.countries) ? (tier.countries as string[]) : [] }))}
              rates={rates}
              token={t}
              hrefFor={(code, country) => `/rdv/conseil/choisir?code=${code}&pays=${country}${tokenParam}`}
              chooseLabel="Choisir cette séance →"
            />
          )}
        </div>
      </main>
      <Footer settings={settings} />
    </>
  );
}
