import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SlotPicker } from "@/components/booking/SlotPicker";
import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { formatWhen } from "@/lib/booking";
import { CALL_MINUTES, listCallSlots, requestByToken } from "@/lib/enterprise-server";
import { env } from "@/lib/env";
import { iaPath } from "@/lib/ia-domain";

import { bookCall } from "../../actions";
import "../../../landing.css";
import "../../entreprises.css";

export const metadata: Metadata = { title: "Appel de cadrage · Bâtisseur IA Entreprises", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** After the request: the person picks the 30-minute scoping call, in their own time zone. */
export default async function CallPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await requestByToken(token);
  if (!request) notFound();
  const booked = request.lead?.bookings[0];
  const upcoming = booked && booked.status === "scheduled" && booked.startsAt > new Date() ? booked : null;
  const listing = upcoming ? null : await listCallSlots().catch(() => null);
  const firstName = request.contactName.split(/\s+/)[0];

  return (
    <div className="ial">
      <IaTopbar current="entreprises" />
      <main className="ent">
        <section className="block">
          <div className="wrap" style={{ maxWidth: 760 }}>
            <div className="sec-head">
              <span className="label">{request.organization}</span>
              <h2>{upcoming ? `C’est noté, ${firstName}.` : `Merci, ${firstName}. Choisissez votre créneau.`}</h2>
              <p>{upcoming ? "Le lien de la visio et le moyen de déplacer l’appel sont dans l’e-mail de confirmation." : `Appel de cadrage de ${CALL_MINUTES} minutes, gratuit, en visio. Les horaires sont affichés à votre heure locale.`}</p>
            </div>
            {upcoming ? (
              <div className="card">
                <h2>Votre appel de cadrage</h2>
                <dl>
                  <dt>Quand</dt><dd>{formatWhen(upcoming.startsAt, upcoming.timezone)} ({upcoming.timezone})</dd>
                  {upcoming.meetUrl && <><dt>Visio</dt><dd><a href={upcoming.meetUrl}>{upcoming.meetUrl.replace(/^https:\/\//, "")}</a></dd></>}
                  <dt>Déplacer</dt><dd><a href={`${env.NEXT_PUBLIC_APP_URL}/rdv/${upcoming.rescheduleToken}`}>Choisir un autre créneau</a></dd>
                </dl>
                <p>Pour préparer l’appel : pensez aux deux ou trois tâches qui prennent le plus de temps à vos équipes chaque semaine.</p>
              </div>
            ) : listing && listing.available ? (
              <SlotPicker
                slots={listing.slots.map((s) => s.toISOString())}
                coachTimeZone={listing.coachTimeZone}
                submitLabel="Confirmer l’appel →"
                emptyMessage="Aucun créneau libre dans les prochaines semaines. Nous vous écrivons sous 48 heures pour en proposer un."
                doneHref={iaPath(`/ia/entreprises/appel/${token}`)}
                onBook={async ({ start, timezone }) => {
                  "use server";
                  return bookCall({ token, start, timezone });
                }}
              />
            ) : (
              <p className="ok">Votre demande est bien enregistrée. L’agenda est momentanément fermé : nous vous écrivons sous 48 heures pour fixer l’appel.</p>
            )}
          </div>
        </section>
      </main>
      <IaFooter />
    </div>
  );
}
