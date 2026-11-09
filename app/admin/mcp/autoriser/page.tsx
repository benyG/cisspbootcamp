import { Plug } from "lucide-react";

import { authorizeSchema } from "@/lib/mcp/oauth";
import { findClient } from "@/lib/mcp/oauth-server";

import { approveMcpAccess, denyMcpAccess } from "../actions";

export const dynamic = "force-dynamic";

/**
 * The consent screen of the MCP plug (docs/MCP.md): reached after the admin's
 * Google sign-in, it says which application asks and where it will return.
 */
export default async function AuthorizeMcpPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = authorizeSchema.safeParse(raw);
  const client = parsed.success ? await findClient(parsed.data.client_id) : null;
  const valid = parsed.success && client && client.redirectUris.includes(parsed.data.redirect_uri);

  if (!valid) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-12">
        <h1 className="text-xl font-bold">Demande d’accès invalide</h1>
        <p className="mt-2 text-sm text-muted">L’application n’est pas enregistrée, ou son adresse de retour ne correspond pas. Relancez la connexion depuis Claude.</p>
      </main>
    );
  }

  const req = parsed.data;
  const host = new URL(req.redirect_uri).host;
  const hidden = Object.entries(req).filter(([, v]) => v !== undefined) as Array<[string, string]>;

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-12">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Plug className="size-6 shrink-0 text-accent" aria-hidden />Autoriser l’accès ?</h1>
      <section className="mt-5 rounded-xl border border-line bg-white p-4 text-sm">
        <p><b>{client.name}</b> demande à piloter l’application avec votre compte admin.</p>
        <p className="mt-2 text-muted">Retour vers : <b className="break-all text-ink">{host}</b></p>
        <ul className="mt-3 grid gap-1 text-ink-2">
          <li>Il pourra lire les cohortes, prospects, paiements et rapports, et faire les actions réversibles (notes, relances, brouillons, codes promo…).</li>
          <li>Il ne pourra ni encaisser, ni supprimer, ni publier tout de suite.</li>
          <li>Chaque appel est noté dans Admin › Prise MCP.</li>
          <li>Vous pouvez le déconnecter à tout moment.</li>
        </ul>
      </section>
      <p className="mt-3 text-xs text-muted">Si vous n’êtes pas en train de connecter Claude ou un de vos outils, refusez.</p>
      <div className="mt-5 flex gap-2">
        <form action={approveMcpAccess}>
          {hidden.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <button className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">Autoriser</button>
        </form>
        <form action={denyMcpAccess}>
          {hidden.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <button className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold">Refuser</button>
        </form>
      </div>
    </main>
  );
}
