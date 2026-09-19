import Link from "next/link";
import { notFound } from "next/navigation";

import { SlotPicker } from "@/components/booking/SlotPicker";
import { formatWhen, listSlots } from "@/lib/booking";
import { prisma } from "@/lib/db";

import { cancelWithToken, rescheduleWithToken } from "../actions";

export const dynamic = "force-dynamic";

/** Reschedule or cancel by the unique link in every e-mail (SPECS A3). */
export default async function ReschedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ rescheduleToken: string }>;
  searchParams: Promise<{ annule?: string }>;
}) {
  const { rescheduleToken } = await params;
  const { annule } = await searchParams;

  const booking = await prisma.booking.findUnique({
    where: { rescheduleToken },
    include: { lead: { select: { firstName: true } } },
  });
  if (!booking) notFound();

  if (booking.status !== "scheduled" || annule === "1") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-16">
        <h1 className="text-2xl font-bold">
          {booking.status === "cancelled" || annule ? "Rendez-vous annulé." : "Ce rendez-vous est passé."}
        </h1>
        <p className="text-[var(--color-muted)]">
          Pour reprendre un créneau plus tard : <Link href="/rdv" className="underline">cisspbootcamp.online/rdv</Link>
        </p>
      </main>
    );
  }

  const listing = await listSlots();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
      <h1 className="text-2xl font-bold">Modifier votre rendez-vous</h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Actuellement : <strong>{formatWhen(booking.startsAt, booking.timezone)}</strong> ({booking.timezone})
      </p>

      <div className="mt-8">
        {listing.available ? (
          <SlotPicker
            slots={listing.slots.map((s) => s.toISOString())}
            coachTimeZone={listing.coachTimeZone}
            submitLabel="Déplacer à ce créneau"
            onBook={async ({ start, timezone }) => {
              "use server";
              return rescheduleWithToken({ rescheduleToken, start, timezone });
            }}
          />
        ) : (
          <p className="text-amber-900">Le déplacement est momentanément indisponible.</p>
        )}
      </div>

      <form
        className="mt-10 border-t border-slate-200 pt-6"
        action={async () => {
          "use server";
          await cancelWithToken(rescheduleToken);
          const { redirect } = await import("next/navigation");
          redirect(`/rdv/${rescheduleToken}?annule=1`);
        }}
      >
        <button type="submit" className="text-sm text-red-700 underline">
          Annuler ce rendez-vous
        </button>
      </form>
    </main>
  );
}
