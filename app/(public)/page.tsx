/**
 * Holding page. The real landing (SPECS A1) is built at step 7, once the
 * scanner, booking and payment flows it links to exist.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 px-5 py-16">
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
        Coach CISSP
      </p>
      <h1 className="text-3xl font-bold text-balance sm:text-4xl">
        Le bootcamp CISSP en français arrive bientôt.
      </h1>
      <p className="text-lg text-[var(--color-muted)]">
        40 heures d&apos;accompagnement, un diagnostic honnête de votre profil,
        et un coach certifié CISSP jusqu&apos;au jour de l&apos;examen.
      </p>
      <p className="text-[var(--color-muted)]">
        Première cohorte en janvier 2027, 10 places.
      </p>
    </main>
  );
}
