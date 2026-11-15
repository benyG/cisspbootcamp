import { ScrollText } from "lucide-react";
import Link from "next/link";

import { prisma } from "@/lib/db";
import { JOURNAL_CATEGORIES, type JournalCategory, QUIET_TYPES, journalLabel, typesOf } from "@/lib/journal";

export const dynamic = "force-dynamic";

const PAGE = 60;
const when = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });

/**
 * Journal (lot D): one place for everything that happened, by hand or on
 * its own: messages, sales, playbooks, AI, Claude, administration.
 */
export default async function JournalPage({ searchParams }: { searchParams: Promise<{ c?: string; avant?: string }> }) {
  const { c, avant } = await searchParams;
  const category = c && c in JOURNAL_CATEGORIES ? (c as JournalCategory) : null;
  const before = Number(avant) || null;
  const types = typesOf(category);
  const rows = await prisma.actionLog.findMany({
    where: {
      ...(types ? { type: { in: types } } : { type: { notIn: [...QUIET_TYPES] } }),
      ...(before ? { id: { lt: before } } : {}),
    },
    orderBy: { id: "desc" },
    take: PAGE,
    include: { lead: { select: { id: true, firstName: true, lastName: true } } },
  });
  const chip = (key: string | null, label: string) => (
    <Link key={label} href={key ? `/admin/journal?c=${key}` : "/admin/journal"} className={"rounded-full px-2.5 py-1 " + (key === category ? "bg-ink text-white" : "bg-slate-100 text-muted")}>{label}</Link>
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><ScrollText className="size-6 shrink-0 text-accent" aria-hidden />Journal</h1>
      <p className="mt-1 text-sm text-muted">Tout ce qui s’est passé, fait par vous ou tout seul.</p>
      <nav className="mt-4 flex flex-wrap gap-1.5 text-xs">
        {chip(null, "Tout")}
        {(Object.keys(JOURNAL_CATEGORIES) as JournalCategory[]).map((k) => chip(k, JOURNAL_CATEGORIES[k].label))}
      </nav>
      {rows.length ? (
        <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-white px-4 text-sm">
          {rows.map((r) => {
            const p = (r.payload ?? {}) as Record<string, unknown>;
            const extra = r.type === "ai_usage" && typeof p.usd === "number" ? ` · ${String(p.feature ?? "")} · ${(p.usd as number).toFixed(3)} USD` : r.type === "mcp_call" ? ` · ${String(p.tool ?? "")}` : "";
            return (
              <li key={r.id} className="grid grid-cols-[6.5rem_1fr] gap-3 py-2">
                <span className="text-xs text-muted tabular-nums">{when.format(r.createdAt)}</span>
                <span>{journalLabel(r.type)}{extra}{r.lead && <> · <Link href={`/admin/leads/${r.lead.id}`} className="underline">{r.lead.firstName} {r.lead.lastName}</Link></>}</span>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-4 text-sm text-muted">Rien ici pour l’instant.</p>}
      {rows.length === PAGE && (
        <Link href={`/admin/journal?${category ? `c=${category}&` : ""}avant=${rows[rows.length - 1]!.id}`} className="mt-3 inline-block text-sm font-semibold underline">Plus anciens</Link>
      )}
    </main>
  );
}
