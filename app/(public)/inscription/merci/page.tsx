import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Stripe's return page. It never marks anything paid: the webhook does. If the
 * webhook has not landed yet, the page says so and refreshes.
 */
export default async function RegistrationThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const registration = ref
    ? await prisma.registration.findUnique({
        where: { reference: ref },
        include: { lead: { select: { firstName: true } }, cohort: { select: { name: true } } },
      })
    : null;

  const paid = registration?.status === "paid";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-5 py-16">
      {!paid && <meta httpEquiv="refresh" content="5" />}
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
        {paid ? "C'est confirmé" : "Paiement en cours de confirmation"}
      </p>
      <h1 className="text-3xl font-bold text-balance">
        {paid
          ? `${registration?.lead.firstName}, votre place dans la ${registration?.cohort.name} est réservée.`
          : "Encore quelques secondes."}
      </h1>
      <p className="text-lg text-[var(--color-muted)]">
        {paid
          ? "Un e-mail de confirmation avec votre reçu vient de partir. Ben vous écrit avant le démarrage."
          : "Nous attendons la confirmation de votre banque. Cette page se met à jour toute seule ; vous recevrez aussi un e-mail."}
      </p>
      {registration && <p className="text-sm text-[var(--color-muted)]">Référence : {registration.reference}</p>}
    </main>
  );
}
