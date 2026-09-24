import Link from "next/link";

import { ordersAwaitingBooking } from "@/lib/consulting";
import { prisma } from "@/lib/db";
import { formatUsdCents } from "@/lib/pricing";
import { formatDuration } from "@/lib/services";

import { confirmServicePayment, remindSessionBooking, updateService } from "./actions";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { pending: "en attente", pending_manual: "à confirmer", paid: "payé", refunded: "remboursé" };

/**
 * Consulting admin (docs/OFFRES.md §5): the catalogue with its prices, the
 * orders, and who has paid but not booked. Ten seconds to read, as always.
 */
export default async function ConsultingAdminPage() {
  const [services, tiers, orders, awaiting] = await Promise.all([
    prisma.service.findMany({ orderBy: { sortOrder: "asc" }, include: { prices: true } }),
    prisma.pricingTier.findMany({ where: { amountUsd: { gt: 0 } }, orderBy: { amountUsd: "asc" } }),
    prisma.serviceOrder.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { lead: { select: { id: true, firstName: true, lastName: true } }, service: { select: { name: true } }, bookings: { where: { status: { in: ["scheduled", "done"] } }, select: { id: true } } } }),
    ordersAwaitingBooking(),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 text-2xl font-bold">Conseil carrière</h1>
      <p className="mt-1 text-sm text-muted">Les plages du mercredi se règlent dans <Link href="/admin/parametres/google" className="underline">Agenda</Link>. Prix en USD entiers ; le code Netticket est facultatif (sans lui : carte seulement).</p>

      {awaiting.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-extrabold tracking-[.06em] text-muted uppercase">Payé, pas encore réservé ({awaiting.length})</h2>
          <ul className="mt-2 grid gap-2">
            {awaiting.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white p-3 text-sm">
                <span><Link href={`/admin/leads/${o.lead.id}`} className="font-bold hover:underline">{o.lead.firstName} {o.lead.lastName}</Link> · {o.service.name} · séance {o.sessionsBooked + 1}/{o.sessionsTotal} · payé il y a {o.daysSincePaid} j</span>
                <form action={remindSessionBooking}><input type="hidden" name="orderId" value={o.id} /><button className={ghost}>Renvoyer le lien</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-extrabold tracking-[.06em] text-muted uppercase">Services</h2>
        <div className="mt-2 grid gap-3">
          {services.map((s) => (
            <form key={s.code} action={updateService} className="rounded-xl border border-line bg-white p-4 text-sm">
              <input type="hidden" name="code" value={s.code} />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{s.name} <span className="font-normal text-muted">· {formatDuration(s.sessions, s.sessionMinutes)}{s.creditable ? " · déductible du bootcamp" : ""}</span></p>
                  <p className="text-muted">{s.tagline}</p>
                </div>
                <label className="flex shrink-0 items-center gap-2"><input type="checkbox" name="active" defaultChecked={s.active} className="size-4 accent-accent" />Actif</label>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {tiers.map((tier) => {
                  const price = s.prices.find((p) => p.tier === tier.code);
                  return (
                    <div key={tier.code} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-lg border border-line px-3 py-2">
                      <span className="text-muted">{tier.label}</span>
                      <span className="flex items-center gap-1"><input name={`price_${tier.code}`} type="number" min={0} step={1} defaultValue={price ? Math.round(price.amountUsd / 100) : 0} className="w-20 rounded-lg border border-line px-2 py-1 text-right" /> USD</span>
                      <input name={`ticket_${tier.code}`} defaultValue={price?.netticketTicketCode ?? ""} placeholder="Code ticket Netticket" className="col-span-2 rounded-lg border border-line px-2 py-1" />
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex justify-end"><button className={primary}>Enregistrer</button></div>
            </form>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-extrabold tracking-[.06em] text-muted uppercase">Commandes ({orders.length})</h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Aucune commande pour l&apos;instant.</p>
        ) : (
          <ul className="mt-2 grid gap-2 text-sm">
            {orders.map((o) => (
              <li key={o.id} className="rounded-xl border border-line bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><Link href={`/admin/leads/${o.lead.id}`} className="font-bold hover:underline">{o.lead.firstName} {o.lead.lastName}</Link> · {o.service.name} · {formatUsdCents(o.amountUsd)} · {o.method} · <b>{STATUS[o.status]}</b> · {o.bookings.length}/{o.sessionsTotal} séance{o.sessionsTotal > 1 ? "s" : ""}{o.creditedRegistrationId ? " · déduit du bootcamp" : ""}</span>
                  <span className="text-muted">{o.reference} · {o.createdAt.toLocaleDateString("fr-FR")}</span>
                </div>
                {o.status === "pending_manual" && (
                  <form action={confirmServicePayment} className="mt-2 flex gap-1">
                    <input type="hidden" name="orderId" value={o.id} />
                    <input name="transactionId" placeholder="N° transaction" className="w-32 rounded-lg border border-line px-2 py-1.5" />
                    <button className={primary}>Confirmer le paiement</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const primary = "rounded-lg bg-accent px-3 py-1.5 text-sm font-bold text-white";
const ghost = "rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold";
