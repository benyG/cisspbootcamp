import Link from "next/link";
import { notFound } from "next/navigation";

import { PracticeTestBox } from "@/components/examboot/PracticeTestBox";
import { formatWhen } from "@/lib/booking";
import { examBootEnabled } from "@/lib/examboot/client";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function BookingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  if (!t) notFound();

  const booking = await prisma.booking.findUnique({
    where: { rescheduleToken: t },
    include: { lead: { select: { firstName: true, source: true } } },
  });
  if (!booking) notFound();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-5 py-16">
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">C&apos;est réservé</p>
      <h1 className="text-3xl font-bold text-balance">
        {booking.lead.firstName}, à {formatWhen(booking.startsAt, booking.timezone)}.
      </h1>
      <p className="text-lg text-[var(--color-muted)]">
        Heure de {booking.timezone}. L&apos;invitation et le lien vidéo arrivent par e-mail.
      </p>
      {booking.meetUrl && (
        <a href={booking.meetUrl} className="text-[var(--color-accent)] underline">
          Lien de la visio
        </a>
      )}
      <p className="text-sm text-[var(--color-muted)]">
        Un empêchement ? <Link href={`/rdv/${t}`} className="underline">Déplacer ou annuler</Link>.
      </p>
      {examBootEnabled() && (
        <PracticeTestBox placement="rdv-confirme" bookingToken={t} title="Avant l’appel : 5 questions pour que Ben cale ses conseils" text="Dix minutes, cinq vraies questions d’examen. Ben voit votre score et arrive à l’appel avec des conseils pour vous, pas des généralités." />
      )}
      {booking.lead.source === "direct_link" && (
        <Link href="/scanner" className="mt-4 rounded-lg border border-[var(--color-accent)] px-5 py-3 text-center font-semibold text-[var(--color-accent)]">
          Avant l&apos;appel : 3 minutes pour analyser votre profil →
        </Link>
      )}
    </main>
  );
}
