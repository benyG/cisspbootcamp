import { signIn } from "@/auth";

/**
 * The only sign-in surface of the app. One provider, one allowed address.
 */
export default function AdminSignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-16">
      <h1 className="text-2xl font-bold">Administration</h1>
      <p className="text-[var(--color-muted)]">
        Accès réservé au compte Google du coach.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/admin" });
        }}
      >
        <button
          type="submit"
          className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-3 text-base font-semibold text-white"
        >
          Se connecter avec Google
        </button>
      </form>
    </main>
  );
}
