import Link from "next/link";
import { notFound } from "next/navigation";

import { SlotPicker } from "@/components/booking/SlotPicker";
import { formatWhen, listSlots } from "@/lib/booking";
import { orderByBookingToken, sessionsBooked } from "@/lib/consulting";

import { bookSessionWithToken } from "../../actions";

export const dynamic = "force-dynamic";

/** Session booking for a paid order: the link in the payment e-mail. */
export default async function SessionBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await orderByBookingToken(token);
  if (!order) notFound();

  const booked = sessionsBooked(order);
  const remaining = order.sessionsTotal - booked;
  const upcoming = order.bookings.find((b) => b.status === "scheduled" && b.startsAt.getTime() > Date.now());
  const canBook = order.status === "paid" && remaining > 0 && !upcoming;
  const listing = canBook ? await listSlots(new Date(), { kind: "consulting", sessionMinutes: order.service.sessionMinutes }) : null;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">Conseil carrière · {order.service.name}</p>
      <h1 className="mt-2 text-3xl font-bold text-balance">
        {order.status !== "paid"
          ? "Paiement en attente."
          : canBook
            ? `${order.lead.firstName}, choisissez ${order.sessionsTotal > 1 ? `le créneau de votre séance ${booked + 1} sur ${order.sessionsTotal}` : "votre créneau"}.`
            : remaining === 0
              ? "Toutes vos séances sont réservées."
              : "Votre prochaine séance est réservée."}
      </h1>
      <p className="mt-2 text-[var(--color-muted)]">
        {order.status !== "paid"
          ? "Dès que le paiement est confirmé, cette page vous propose les créneaux. Vous recevrez aussi un e-mail."
          : `Séance de ${order.service.sessionMinutes} minutes en visio. Un empêchement ? Chaque confirmation contient un lien pour déplacer ou annuler, gratuit jusqu'à 24 h avant.`}
      </p>

      {order.bookings.length > 0 && (
        <ul className="mt-6 grid gap-2 text-sm">
          {order.bookings.map((b, index) => (
            <li key={b.id} className="rounded-lg border border-line bg-white px-3 py-2">
              Séance {index + 1} · {formatWhen(b.startsAt, b.timezone)} ({b.timezone}) · {b.status === "done" ? "passée" : "à venir"}
              {b.status === "scheduled" && <> · <Link href={`/rdv/${b.rescheduleToken}`} className="underline">déplacer</Link></>}
              {b.meetUrl && b.status === "scheduled" && <> · <a href={b.meetUrl} className="underline">visio</a></>}
            </li>
          ))}
        </ul>
      )}

      {canBook && listing && (
        <div className="mt-8">
          {!listing.available ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">La réservation est momentanément fermée. Réessayez un peu plus tard : votre séance reste due.</p>
          ) : (
            <SlotPicker
              slots={listing.slots.map((s) => s.toISOString())}
              coachTimeZone={listing.coachTimeZone}
              emptyMessage="Aucun créneau de conseil libre dans les cinq prochaines semaines. Réessayez dans quelques jours : votre séance reste due, et Ben ouvre des plages régulièrement."
              onBook={async ({ start, timezone }) => {
                "use server";
                return bookSessionWithToken({ token, start, timezone });
              }}
            />
          )}
        </div>
      )}

      {order.status === "paid" && remaining > 0 && upcoming && (
        <p className="mt-6 text-sm text-[var(--color-muted)]">Il vous reste {remaining} séance{remaining > 1 ? "s" : ""} à réserver ; revenez sur ce lien après celle-ci.</p>
      )}
    </main>
  );
}
