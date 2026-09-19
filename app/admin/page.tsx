import Link from "next/link";

import { auth } from "@/auth";

/**
 * Admin home. The daily action queue (SPECS A6) lands at step 6; until then
 * this only proves the single-admin gate works end to end.
 */
export default async function AdminHomePage() {
  const session = await auth();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <h1 className="text-2xl font-bold">Administration</h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Connecté en tant que {session?.user?.email}.
      </p>
      <ul className="mt-6 flex flex-col gap-2">
        <li>
          <Link
            href="/admin/diagnostics"
            className="block rounded-xl border border-slate-200 bg-white px-4 py-3.5 font-semibold"
          >
            Diagnostics à valider →
          </Link>
        </li>
      </ul>
      <p className="mt-6 text-sm text-[var(--color-muted)]">
        La file d&apos;actions complète arrive à l&apos;étape 6.
      </p>
    </main>
  );
}
