import { type EnterpriseOffer, LEVELS, type Proposal, durationLabel, formatUsd, proposalTimeline, proposalTotals } from "@/lib/enterprise";
import { IA_COMPANY, IA_TEAM } from "@/lib/ia-brand";

import "./proposal.css";

const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const addDays = (iso: string, days: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);

export type ProposalHeader = { number: string | null; organization: string };

/**
 * The proposal itself, four A4 pages written for a director who is not
 * technical: what you told us, what changes, how, the price, how to start.
 * Shared by the editor (live preview) and the print.
 */
export function ProposalDocument({ p, offer, head, today }: { p: Proposal; offer: EnterpriseOffer; head: ProposalHeader; today: string }) {
  const issued = p.issuedOn ?? today;
  const ref = `${head.number ?? "DEV-…"} · ${head.organization}`;
  const totals = proposalTotals(p, offer);
  const { steps, weeks } = proposalTimeline(p, offer);
  const pkg = (code: string) => offer.packages.find((x) => x.code === code);
  const foot = (n: number) => <div className="pfoot"><span>{n === 1 ? `${IA_TEAM} · ${IA_COMPANY}` : ref}</span><span>{n}</span></div>;

  return (
    <div className="prop doc" id="proposal-doc" aria-label="Aperçu de la proposition">
      <section className="page cover">
        <div className="pad">
          <div className="brandline"><span className="brand">Bâtisseur <span>IA</span></span><span className="ref">{head.number ?? "Brouillon"}<br />{longDate(issued)}</span></div>
          <div className="cover-title">
            <span className="for">Proposition d’accompagnement pour {head.organization}</span>
            <h1>Vos processus tournent avec l’IA. <em>Vous gardez la main.</em></h1>
            <p>Ce document vous dit, en quelques pages, ce que nous allons mettre en place chez vous, en combien de temps, à quel prix, et comment vous gardez le contrôle à chaque étape.</p>
          </div>
          <div className="promise">{p.goals.map((g) => <div key={g.title}><b>{g.title}</b><span>{g.text}</span></div>)}</div>
          <div className="cover-meta">
            <div><span>Préparé pour</span><b>{[p.contact, p.role].filter(Boolean).join(", ")}</b></div>
            <div><span>Durée</span><b>{durationLabel(weeks, totals.monthlyUsd > 0)}</b></div>
            <div><span>Valable jusqu’au</span><b>{longDate(addDays(issued, p.validDays))}</b></div>
          </div>
        </div>
        {foot(1)}
      </section>

      <section className="page">
        <div className="pad">
          <span className="eyebrow">Votre situation</span>
          <h2>Ce que vous nous avez dit</h2>
          <ul className="heard">{p.heard.map((h) => <li key={h}>{h}</li>)}</ul>
          <span className="eyebrow">Nos objectifs communs</span>
          <h2>Ce qui va changer</h2>
          <div className="goals">{p.goals.map((g, i) => <div key={g.title} className="goal"><b>0{i + 1}</b><p>{g.title}<small>{g.text}</small></p></div>)}</div>
          {p.processes.length > 0 && (
            <>
              <span className="eyebrow">Avant / après</span>
              <div className="ba">
                <div className="ba-row"><span>Processus</span><span>Aujourd’hui</span><span /><span>Après</span></div>
                {p.processes.map((r) => (
                  <div key={r.name} className="ba-row"><span>{r.name}</span><span className={`pill ${r.before}`}>{LEVELS[r.before]}</span><span className="arr">→</span><span className={`pill ${r.after}`}>{LEVELS[r.after]}</span></div>
                ))}
              </div>
              <p className="notes">Manuel : une personne fait tout. Assisté : l’IA prépare, une personne valide. Autonome : l’IA agit seule selon vos règles, avec plafond et journal.</p>
            </>
          )}
        </div>
        {foot(2)}
      </section>

      <section className="page">
        <div className="pad">
          <span className="eyebrow">Notre démarche</span>
          <h2>Comment nous y allons</h2>
          <div className="tl">
            {steps.map((s) => (
              <div key={s.pkg.code} className="tl-step">
                <span className="tl-when">{s.when}</span>
                <div><h3>{s.pkg.name}</h3><ul>{s.pkg.items.map((i) => <li key={i}>{i}</li>)}</ul><p className="out">→ {s.pkg.outcome}</p></div>
              </div>
            ))}
          </div>
          <span className="eyebrow">Vous gardez la main</span>
          <div className="ctl">
            <div><b>Validation humaine</b><span>Rien ne part vers un client, aucun paiement, aucune décision sur une personne sans votre accord.</span></div>
            <div><b>Un interrupteur par automatisation</b><span>Tout s’arrête en un clic ; le travail manuel reprend.</span></div>
            <div><b>Budget plafonné</b><span>Coûts d’IA et de WhatsApp sur vos comptes, avec alerte à 80 %.</span></div>
            <div><b>Tout est à vous</b><span>Comptes, code et documentation à votre nom. Aucune dépendance à nous.</span></div>
          </div>
        </div>
        {foot(3)}
      </section>

      <section className="page">
        <div className="pad">
          <span className="eyebrow">Votre investissement</span>
          <h2>Prix fixe, sans surprise</h2>
          <table className="inv">
            <thead><tr><th>Ce que vous achetez</th><th className="num">Montant</th></tr></thead>
            <tbody>
              {p.lines.map((l) => {
                const k = pkg(l.code);
                return <tr key={l.code}><td><b>{k?.name ?? l.code}</b><small>{k?.outcome}</small></td><td className="num">{formatUsd(l.priceUsd)}{k?.monthly ? " / mois" : ""}</td></tr>;
              })}
            </tbody>
            <tfoot>
              <tr className="total"><td>Total</td><td className="num">{totals.onceUsd > 0 ? formatUsd(totals.onceUsd) : ""}{totals.onceUsd > 0 && totals.monthlyUsd > 0 ? " + " : ""}{totals.monthlyUsd > 0 ? `${formatUsd(totals.monthlyUsd)} / mois` : ""}</td></tr>
            </tfoot>
          </table>
          <div className="sched">
            {totals.onceUsd > 0 ? (
              <>
                <div><span>À la commande (acompte 50 %)</span><b>{formatUsd(totals.depositUsd)}</b></div>
                <div><span>À la livraison</span><b>{formatUsd(totals.balanceUsd)}</b></div>
              </>
            ) : (
              <div><span>À la commande (premier mois)</span><b>{formatUsd(totals.depositUsd)}</b></div>
            )}
          </div>
          <p className="notes">Prix en dollars américains, hors taxes. Les coûts d’usage (IA, WhatsApp, hébergement) sont payés directement par vous, sur vos comptes, avec un plafond que vous fixez. Paiement par carte ou virement ; un reçu numéroté est émis à chaque paiement.</p>
          <span className="eyebrow">Pourquoi nous</span>
          <div className="why">
            <div><b>Nous l’utilisons nous-mêmes</b><span>Notre propre entreprise tourne avec ces outils : vous les verrez fonctionner avant de signer.</span></div>
            <div><b>Un résultat mesuré</b><span>Objectifs fixés avant, mesurés après, point d’arrêt à mi-parcours.</span></div>
          </div>
          <span className="eyebrow">Prochaines étapes</span>
          <ol className="next">
            <li><span>Vous signez ce bon pour accord<small>Ou vous nous écrivez « accord » en réponse à l’e-mail.</small></span></li>
            <li><span>Vous réglez l’acompte<small>Par carte, avec le lien reçu, ou par virement.</small></span></li>
            <li><span>{p.start ? <>Nous démarrons le <b>{p.start}</b></> : "Nous fixons ensemble la date de démarrage"}<small>Par un atelier d’une heure avec votre référent.</small></span></li>
          </ol>
          <div className="sign">
            <div><span>Pour le client · bon pour accord</span><b>{p.contact}</b><i>Date et signature</i></div>
            <div><span>Pour Bâtisseur IA</span><b>{`${IA_TEAM} · ${IA_COMPANY}`}</b><i>Date et signature</i></div>
          </div>
        </div>
        {foot(4)}
      </section>
    </div>
  );
}

