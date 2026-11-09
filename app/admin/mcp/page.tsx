import { Plug } from "lucide-react";
import Link from "next/link";

import { CopyLink } from "@/components/admin/CopyLink";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { endpoints } from "@/lib/mcp/oauth";
import { MCP_TOOLS } from "@/lib/mcp/tools";

import { disconnectMcpClient } from "./actions";

export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const fmt = (d: Date | null) => (d ? when.format(d) : "jamais");

/**
 * The MCP plug (Ben, 09/11; docs/MCP.md): the address to paste into Claude,
 * the applications connected, and the journal of their calls.
 */
export default async function McpPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const url = endpoints(env.NEXT_PUBLIC_APP_URL).resource;
  const [clients, calls] = await Promise.all([
    prisma.mcpClient.findMany({ where: { authorizedAt: { not: null } }, orderBy: { authorizedAt: "desc" } }),
    prisma.actionLog.findMany({ where: { type: "mcp_call" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, payload: true, createdAt: true } }),
  ]);
  const titles = new Map(MCP_TOOLS.map((t) => [t.name, t.title]));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Plug className="size-6 shrink-0 text-accent" aria-hidden />Prise MCP</h1>
      <p className="mt-1 text-sm text-muted">Pilotez l’application depuis Claude (ou un autre outil MCP) : « Où en est la cohorte de janvier ? », « Qui dois-je rappeler aujourd’hui ? ». Pour l’instant, la prise lit seulement : elle ne modifie et n’envoie rien.</p>
      {ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{ok}</p>}

      <section className="mt-5 rounded-xl border border-line bg-white p-4 text-sm">
        <h2 className="font-bold">Brancher Claude</h2>
        <div className="mt-2"><CopyLink value={url} /></div>
        <ol className="mt-3 grid list-decimal gap-1 pl-5 text-ink-2">
          <li>Dans Claude : Paramètres › Connecteurs › <b>Ajouter un connecteur personnalisé</b>.</li>
          <li>Nom : « CISSP Bootcamp », adresse : celle ci-dessus. Laissez les options avancées vides.</li>
          <li>Cliquez « Se connecter » : la connexion Google de l’admin s’ouvre, puis « Autoriser ».</li>
          <li>Dans une conversation, activez le connecteur et posez votre question.</li>
        </ol>
        <p className="mt-2 text-xs text-muted">Claude Code : <code className="break-all">claude mcp add --transport http cisspbootcamp {url}</code></p>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-white p-4 text-sm">
        <h2 className="font-bold">Applications connectées</h2>
        {clients.length === 0 ? (
          <p className="mt-2 text-muted">Aucune pour l’instant.</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {clients.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-line pb-2">
                <span><b>{c.name}</b><span className="block text-xs text-muted">Autorisée le {fmt(c.authorizedAt)} · dernier usage : {fmt(c.lastUsedAt)}</span></span>
                <form action={disconnectMcpClient}><input type="hidden" name="clientId" value={c.clientId} /><button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold">Déconnecter</button></form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-4 rounded-xl border border-line bg-white p-4 text-sm">
        <h2 className="font-bold">Ce que Claude peut faire ({MCP_TOOLS.length} outils, lecture seule)</h2>
        <ul className="mt-2 grid gap-1 text-ink-2 sm:grid-cols-2">
          {MCP_TOOLS.map((t) => <li key={t.name}>{t.title}</li>)}
        </ul>
        <p className="mt-2 text-xs text-muted">Prochains lots : actions réversibles (notes, relances, codes promo, posts programmés…), puis actions sensibles préparées par Claude et validées par vous ici.</p>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-white p-4 text-sm">
        <h2 className="font-bold">Derniers appels</h2>
        {calls.length === 0 ? (
          <p className="mt-2 text-muted">Aucun appel pour l’instant.</p>
        ) : (
          <ul className="mt-2 grid gap-1">
            {calls.map((c) => {
              const p = (c.payload ?? {}) as { tool?: string; ok?: boolean; client?: string };
              return (
                <li key={c.id} className="flex justify-between gap-3 text-ink-2">
                  <span>{titles.get(p.tool ?? "") ?? p.tool}{p.ok === false && <b className="ml-1 text-red-700">· échec</b>}<span className="text-xs text-muted"> · {p.client}</span></span>
                  <span className="shrink-0 text-xs text-muted">{fmt(c.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
