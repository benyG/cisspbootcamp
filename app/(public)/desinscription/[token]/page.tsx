import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";

import { unsubscribe } from "./actions";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ fait?: string }>;
}) {
  const { token } = await params;
  const { fait } = await searchParams;

  const lead = await prisma.lead.findUnique({
    where: { unsubscribeToken: token },
    select: { unsubscribedAt: true },
  });
  if (!lead) notFound();

  const done = fait === "1" || Boolean(lead.unsubscribedAt);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 px-5 py-16">
      {done ? (
        <>
          <h1 className="text-2xl font-bold">Vous êtes désinscrit.</h1>
          <p className="text-[var(--color-muted)]">
            Vous ne recevrez plus aucun message. Pour faire supprimer vos données
            entièrement, répondez à n&apos;importe quel e-mail reçu de Ben.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Ne plus recevoir de messages ?</h1>
          <p className="text-[var(--color-muted)]">
            Un clic suffit. Ben ne vous recontactera plus.
          </p>
          <form
            action={async () => {
              "use server";
              await unsubscribe(token);
              const { redirect } = await import("next/navigation");
              redirect(`/desinscription/${token}?fait=1`);
            }}
          >
            <button
              type="submit"
              className="w-full rounded-lg bg-[var(--color-ink)] px-4 py-3 font-semibold text-white"
            >
              Me désinscrire
            </button>
          </form>
        </>
      )}
    </main>
  );
}
