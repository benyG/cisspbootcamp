import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { AI_FEATURES, type AiFeature } from "@/lib/ai-usage";
import { aiSpendThisMonth } from "@/lib/ai-usage-server";
import { AUTOMATION_KEYS, AUTOMATIONS, automationState } from "@/lib/guardrails";
import { loadGuardrails } from "@/lib/guardrails-server";

import { setAutomation, setLimits, setStopped } from "./actions";

export const dynamic = "force-dynamic";

const at = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
const usd = (n: number) => `${n.toFixed(2)} USD`;

/**
 * Garde-fous (lot A): what the Bâtisseur IA teaches, applied to our own
 * pilot. One general stop, one switch per automation, the pressure cap and
 * the AI budget. Payments, seat holds and statuses never stop.
 */
export default async function GuardrailsPage() {
  const [g, spend] = await Promise.all([loadGuardrails(), aiSpendThisMonth()]);
  const pct = spend.budgetUsd > 0 ? Math.min(100, Math.round((spend.spentUsd / spend.budgetUsd) * 100)) : 100;
  const features = Object.entries(spend.byFeature).sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><ShieldAlert className="size-6 shrink-0 text-accent" aria-hidden />Garde-fous</h1>
      <p className="mt-1 text-sm text-muted">Ce qui tourne seul, ce qui peut s’arrêter, et jusqu’où.</p>

      <section className={"mt-6 rounded-xl border p-4 " + (g.stopped ? "border-red-300 bg-red-50" : "border-line bg-white")}>
        <h2 className="font-bold">Arrêt général</h2>
        {g.stopped ? (
          <p className="mt-1 text-sm text-red-900"><b>Tout est à l’arrêt</b>{g.stoppedAt ? ` depuis le ${at.format(new Date(g.stoppedAt))}` : ""}. Aucun message automatique ne part. Le rapport du lundi continue.</p>
        ) : (
          <p className="mt-1 text-sm text-muted">Un clic suspend tous les envois automatiques. Les paiements, les places tenues et les statuts de cohorte continuent.</p>
        )}
        <form action={setStopped} className="mt-3">
          <input type="hidden" name="stopped" value={g.stopped ? "0" : "1"} />
          <button className={"rounded-lg px-4 py-2 text-sm font-bold text-white " + (g.stopped ? "bg-ink" : "bg-red-700")}>{g.stopped ? "Tout relancer" : "Tout arrêter"}</button>
        </form>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-white p-4">
        <h2 className="font-bold">Budget IA · {spend.month.split("-").reverse().join("/")}</h2>
        <p className="mt-1 text-sm"><b>{usd(spend.spentUsd)}</b> sur {usd(spend.budgetUsd)} · {spend.calls} appel{spend.calls > 1 ? "s" : ""}</p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Budget IA consommé">
          <div className={"h-full " + (pct >= 100 ? "bg-red-600" : pct >= 80 ? "bg-amber-500" : "bg-accent")} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1 text-xs text-muted">E-mail à 80 % et à 100 %. Budget atteint : les fonctions IA s’arrêtent jusqu’au 1er du mois ; le message après une analyse passe au modèle écrit.</p>
        {features.length > 0 && (
          <ul className="mt-3 grid gap-1 text-sm">
            {features.map(([f, v]) => <li key={f} className="flex justify-between gap-3"><span>{AI_FEATURES[f as AiFeature] ?? f}</span><span className="tabular-nums text-muted">{usd(v)}</span></li>)}
          </ul>
        )}
      </section>

      <form action={setLimits} className="mt-4 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Budget IA par mois (USD)</span>
          <input name="aiBudgetUsd" type="number" min={0} max={10000} step={1} defaultValue={g.aiBudgetUsd} className="rounded-lg border border-line px-3 py-2" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Messages automatiques par personne et par semaine</span>
          <input name="pressurePerWeek" type="number" min={1} max={7} step={1} defaultValue={g.pressurePerWeek} className="rounded-lg border border-line px-3 py-2" />
        </label>
        <button className="justify-self-start rounded-lg bg-accent px-4 py-2 text-sm font-bold text-white sm:col-span-2">Enregistrer</button>
      </form>

      <section className="mt-4 rounded-xl border border-line bg-white p-4">
        <h2 className="font-bold">Automatisations</h2>
        <ul className="mt-2 divide-y divide-line">
          {AUTOMATION_KEYS.map((key) => {
            const a = AUTOMATIONS[key];
            const state = automationState(g, key);
            const on = !g.off.includes(key);
            return (
              <li key={key} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 text-sm">
                  <b>{a.label}</b>
                  <span className="block text-xs text-muted">{a.detail}</span>
                  {state === "stopped" && <span className="block text-xs font-semibold text-red-800">Suspendu par l’arrêt général</span>}
                </span>
                <form action={setAutomation}>
                  <input type="hidden" name="key" value={key} />
                  <input type="hidden" name="on" value={on ? "0" : "1"} />
                  <button aria-pressed={on} className={"w-24 rounded-lg px-3 py-1.5 text-sm font-semibold " + (on ? "bg-ink text-white" : "border border-line text-muted")}>{on ? "Activée" : "Arrêtée"}</button>
                </form>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">Ne s’arrêtent jamais : confirmations de paiement, numérotation des reçus, expiration des places tenues, statuts de cohorte, synchronisation des vidéos et des tests.</p>
      </section>

      <p className="mt-4 flex flex-wrap gap-2 text-xs">
        <Link href="/admin/playbooks" className="rounded-full bg-slate-100 px-2.5 py-1 text-muted hover:underline">Playbooks et leur journal</Link>
        <Link href="/admin/mcp/demandes" className="rounded-full bg-slate-100 px-2.5 py-1 text-muted hover:underline">Demandes de Claude à valider</Link>
      </p>
    </main>
  );
}
