import { signIn } from "@/auth";

/** Only back into the admin: a callback elsewhere is ignored. */
function safeCallback(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && value.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}

/**
 * The only sign-in surface of the app. One provider, one allowed address.
 * Returns to the page that asked (the MCP consent screen keeps its query).
 */
export default async function AdminSignInPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string | string[] }> }) {
  const redirectTo = safeCallback((await searchParams).callbackUrl);
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-16">
      <h1 className="text-2xl font-bold">Administration</h1>
      <p className="text-[var(--color-muted)]">
        Accès réservé au compte Google du coach.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo });
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
