import { ShieldCheck } from "lucide-react";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { KIND_LABEL, type RequestKind, expireRequests } from "@/lib/mcp/requests";

import { decideMcpRequestAction } from "../actions";

export const dynamic = "force-dynamic";
// A validated request may publish on LinkedIn or send a batch of e-mails.
export const maxDuration = 300;

const when = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
const STATUS: Record<string, { label: string; style: string }> = {
  done: { label: "Fait", style: "bg-[var(--color-accent-soft)] text-[var(--color-accent-ink)]" },
  failed: { label: "Échec", style: "bg-red-50 text-red-800" },
  rejected: { label: "Refusée", style: "bg-slate-100 text-slate-700" },
  expired: { label: "Expirée", style: "bg-slate-100 text-slate-700" },
  running: { label: "En cours", style: "bg-sky-50 text-sky-800" },
};

/**
 * Lot 3 of the MCP plug (docs/MCP.md): what Claude prepared and waits for
 * Ben. Each request says in plain words what will happen; "Valider" runs it
 * through the same code as the admin's own button, once.
 */
export default async function McpRequestsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const { ok, erreur } = await searchParams;
  await expireRequests();
  const [pending, recent] = await Promise.all([
    prisma.mcpRequest.findMany({ where: { status: "pending" }, orderBy: { createdAt: "asc" } }),
    prisma.mcpRequest.findMany({ where: { status: { not: "pending" } }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin/mcp" className="text-sm text-muted">← Prise MCP</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="size-6 shrink-0 text-accent" aria-hidden />Demandes de Claude à valider</h1>
      <p className="mt-1 text-sm text-muted">Paiements, envois, publication immédiate, prix, suppressions : Claude les prépare, rien ne se fait sans votre clic. Une demande non traitée expire au bout de 7 jours.</p>
      {ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{ok}</p>}
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{erreur}</p>}

      {pending.length === 0 ? (
        <p className="mt-5 rounded-xl border border-line bg-white p-4 text-sm text-muted">Aucune demande en attente.</p>
      ) : (
        <ul className="mt-5 grid gap-3">
          {pending.map((r) => {
            const [title, ...lines] = r.summary.split("\n");
            return (
              <li key={r.id} className="rounded-xl border border-line border-l-4 border-l-amber-400 bg-white p-4">
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">N°{r.id} · {title} · {r.clientName} · {when.format(r.createdAt)}</p>
                <p className="mt-2 text-sm whitespace-pre-line break-words">{lines.join("\n")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={decideMcpRequestAction}><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="decision" value="approve" /><button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white">Valider</button></form>
                  <form action={decideMcpRequestAction}><input type="hidden" name="requestId" value={r.id} /><input type="hidden" name="decision" value="reject" /><button className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">Refuser</button></form>
                  <span className="self-center text-xs text-muted">Expire le {when.format(r.expiresAt)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {recent.length > 0 && (
        <section className="mt-6 rounded-xl border border-line bg-white p-4 text-sm">
          <h2 className="font-bold">Dernières demandes traitées</h2>
          <ul className="mt-2 grid gap-2">
            {recent.map((r) => {
              const s = STATUS[r.status] ?? { label: r.status, style: "bg-slate-100" };
              return (
                <li key={r.id} className="flex items-start gap-2.5">
                  <span className={"mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase " + s.style}>{s.label}</span>
                  <span className="min-w-0">N°{r.id} · {KIND_LABEL[r.kind as RequestKind] ?? r.kind} · {r.summary.split("\n")[1] ?? ""}{r.result && <span className="block text-xs text-muted">{r.result}</span>}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
