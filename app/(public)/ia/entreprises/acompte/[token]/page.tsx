import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Fragment } from "react";

import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { findPackage, formatUsd, proposalTotals } from "@/lib/enterprise";
import { loadOffer, readProposal, requestByToken } from "@/lib/enterprise-server";

import { payDeposit } from "../../actions";
import "../../../landing.css";
import "../../entreprises.css";

export const metadata: Metadata = { title: "Acompte · Bâtisseur IA Entreprises", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The deposit link sent with the proposal: what is ordered, the amount, card payment. */
export default async function DepositPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const request = await requestByToken(token);
  if (!request) notFound();
  const proposal = readProposal(request.proposal);
  const offer = await loadOffer();
  const ready = Boolean(proposal && request.depositUsd && request.depositReference && request.quoteNumber);
  const paid = Boolean(request.depositPaidAt);
  const lines = proposal?.lines.map((l) => ({ pkg: findPackage(offer, l.code), priceUsd: l.priceUsd })).filter((l) => l.pkg) ?? [];
  const totals = proposal ? proposalTotals(proposal, offer) : null;

  return (
    <div className="ial">
      <IaTopbar current="entreprises" />
      <main className="ent">
        <section className="block">
          <div className="wrap" style={{ maxWidth: 760 }}>
            <div className="sec-head">
              <span className="label">{request.organization}{request.quoteNumber ? ` · ${request.quoteNumber}` : ""}</span>
              <h2>{paid ? "Acompte reçu. Merci." : "Votre acompte de démarrage"}</h2>
              <p>{paid ? "Le reçu vous a été envoyé par e-mail. Nous revenons vers vous sous 48 heures pour fixer l’atelier de démarrage." : "Il lance la mission. Le solde est demandé à la livraison."}</p>
            </div>
            {query.merci && !paid && <p className="ok">Paiement en cours de confirmation. Vous recevrez le reçu par e-mail dans quelques minutes.</p>}
            {query.annule && !paid && <p className="err">Le paiement n’a pas abouti. Vous pouvez réessayer ci-dessous.</p>}
            {query.erreur && <p className="err">Le paiement n’a pas pu démarrer. Réessayez dans un instant ou répondez à notre e-mail.</p>}
            {!ready ? (
              <p className="ok">Votre proposition est en préparation. Vous recevrez le lien de paiement avec elle.</p>
            ) : (
              <div className="card">
                <h2>Ce que vous commandez</h2>
                <dl>
                  {lines.map((l) => <Fragment key={l.pkg!.code}><dt>{l.pkg!.name}</dt><dd>{l.pkg!.monthly ? `${formatUsd(l.priceUsd)} / mois` : formatUsd(l.priceUsd)}</dd></Fragment>)}
                  {totals && totals.onceUsd > 0 && <><dt>Total hors abonnement</dt><dd>{formatUsd(totals.onceUsd)}</dd></>}
                  <dt>Acompte à régler</dt><dd>{formatUsd(request.depositUsd!)}</dd>
                </dl>
                {!paid && (
                  <form action={payDeposit}>
                    <input type="hidden" name="token" value={token} />
                    <button className="btn btn-go btn-big" type="submit">Payer {formatUsd(request.depositUsd!)} par carte</button>
                  </form>
                )}
                <p style={{ fontSize: ".9rem", color: "var(--muted)" }}>Carte Visa ou Mastercard, paiement sécurisé par Stripe. Vous préférez un virement ? Répondez à l’e-mail de la proposition : nous vous envoyons les coordonnées et confirmons la réception à la main.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <IaFooter />
    </div>
  );
}
