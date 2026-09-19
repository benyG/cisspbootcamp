import type { Metadata } from "next";

import { SlotPicker } from "@/components/booking/SlotPicker";
import { listSlots } from "@/lib/booking";
import { prisma } from "@/lib/db";

import { bookDirect, bookWithResultToken } from "./actions";

export const metadata: Metadata = {
  title: "Réserver 15 minutes avec Ben — Coach CISSP",
};
export const dynamic = "force-dynamic";

export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t: token } = await searchParams;

  const lead = token
    ? await prisma.scannerResponse
        .findUnique({ where: { resultToken: token }, select: { lead: { select: { firstName: true } } } })
        .then((r) => r?.lead ?? null)
    : null;

  const listing = await listSlots();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
        Appel de découverte
      </p>
      <h1 className="mt-2 text-3xl font-bold text-balance">
        {lead ? `${lead.firstName}, choisissez votre créneau.` : "15 minutes avec Ben."}
      </h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Un appel vidéo de 15 minutes pour vérifier que le bootcamp vous convient et fixer
        votre date d&apos;examen. Sans engagement.
      </p>

      <div className="mt-8">
        {!listing.available ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            La réservation est momentanément fermée. Réessayez un peu plus tard.
          </p>
        ) : token && lead ? (
          <SlotPicker
            slots={listing.slots.map((s) => s.toISOString())}
            coachTimeZone={listing.coachTimeZone}
            onBook={async ({ start, timezone }) => {
              "use server";
              return bookWithResultToken({ token, start, timezone });
            }}
          />
        ) : (
          <SlotPicker
            slots={listing.slots.map((s) => s.toISOString())}
            coachTimeZone={listing.coachTimeZone}
            askContact
            onBook={async ({ start, timezone, contact }) => {
              "use server";
              return bookDirect({
                firstName: contact?.firstName ?? "",
                lastName: contact?.lastName ?? "",
                email: contact?.email ?? "",
                consent: contact?.consent as true,
                start,
                timezone,
              });
            }}
          />
        )}
      </div>
    </main>
  );
}
