export default function ScannerThanksPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-5 px-5 py-16">
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">
        C&apos;est envoyé
      </p>
      <h1 className="text-3xl font-bold text-balance">
        Ben regarde votre profil.
      </h1>
      <p className="text-lg text-[var(--color-muted)]">
        Vous recevez son analyse par e-mail sous 24 heures : où vous en êtes, ce
        qu&apos;il vous manque, et le délai réaliste pour l&apos;examen.
      </p>
      <p className="text-[var(--color-muted)]">
        Un message de confirmation vient de partir. S&apos;il n&apos;est pas dans
        votre boîte, vérifiez les courriers indésirables.
      </p>
    </main>
  );
}
