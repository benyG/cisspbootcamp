import Link from "next/link";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Return page after payment. It never marks anything paid: the webhook does.
 * Once paid, the booking link is right here, not only in the e-mail.
 */
export default async function ServiceThanksPage({ searchParams }: { searchParams: Promise<{ ref?: string; mobile?: string }> }) {
  const { ref, mobile } = await searchParams;
  const order = ref ? await prisma.serviceOrder.findUnique({ where: { reference: ref }, include: { lead: { select: { firstName: true } }, service: { select: { name: true, sessionMinutes: true } } } }) : null;
  const paid = order?.status === "paid";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-5 py-16">
      {!paid && <meta httpEquiv="refresh" content="5" />}
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">{paid ? "C'est réglé" : "Paiement en cours de confirmation"}</p>
      <h1 className="text-3xl font-bold text-balance">
        {paid ? `${order?.lead.firstName}, choisissez maintenant votre créneau.` : "Encore quelques secondes."}
      </h1>
      <p className="text-lg text-[var(--color-muted)]">
        {paid
          ? `Votre séance « ${order?.service.name} » est réglée. Le lien ci-dessous est personnel ; il est aussi dans l'e-mail que vous venez de recevoir.`
          : mobile
            ? "Confirmez le paiement sur votre téléphone (code USSD ou notification de l'opérateur). Cette page se met à jour toute seule ; vous recevrez aussi un e-mail."
            : "Nous attendons la confirmation de votre banque. Cette page se met à jour toute seule ; vous recevrez aussi un e-mail."}
      </p>
      {paid && order && (
        <Link href={`/conseil/rdv/${order.bookingToken}`} className="rounded-[14px] bg-ink px-5 py-4 text-center text-lg font-extrabold text-white">Choisir mon créneau →</Link>
      )}
      {order && <p className="text-sm text-[var(--color-muted)]">Référence : {order.reference}</p>}
    </main>
  );
}
