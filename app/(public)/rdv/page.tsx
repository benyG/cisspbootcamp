import type { Metadata } from "next";
import { CalendarCheck, Clock, Gift, Lightbulb } from "lucide-react";
import Link from "next/link";

import { SlotPicker } from "@/components/booking/SlotPicker";
import { listSlots } from "@/lib/booking";
import { loadServices } from "@/lib/consulting";
import { prisma } from "@/lib/db";
import { groupByFormat, parseFormatKey } from "@/lib/services";

import { bookWithResultToken, holdConsultingFormatSlot, holdSlotThenProfile } from "./actions";

export const metadata: Metadata = {
  title: "Prendre rendez-vous avec Ben — Coach CISSP",
};
export const dynamic = "force-dynamic";

/**
 * The one door to an appointment (Ben, 24/09, evening). Two options, always
 * visible: the free 15-minute first contact, and the paid in-depth
 * consultation. In both cases the slot comes first and nothing is confirmed
 * before the profile analysis; for a paid session the palette of services
 * and prices only appears once a format and a slot are chosen.
 */
export default async function BookingPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; type?: string; format?: string }>;
}) {
  const { t: token, type, format } = await searchParams;
  const paid = type === "approfondie";

  const lead = token
    ? await prisma.scannerResponse
        .findUnique({ where: { resultToken: token }, select: { lead: { select: { firstName: true } } } })
        .then((r) => r?.lead ?? null)
    : null;
  const tokenParam = token ? `&t=${encodeURIComponent(token)}` : "";

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
      <p className="text-sm font-semibold tracking-wide text-[var(--color-accent)] uppercase">Rendez-vous avec Ben · coach CISSP</p>
      <h1 className="mt-2 text-3xl font-bold text-balance">{lead ? `${lead.firstName}, prenez rendez-vous.` : "Prendre rendez-vous avec Ben."}</h1>
      <p className="mt-2 text-[var(--color-muted)]">
        Vous choisissez votre créneau. {lead ? "Votre analyse de profil est déjà faite : le rendez-vous se confirme au clic." : "Rien n’est confirmé avant votre analyse de profil : 3 minutes, et Ben arrive au rendez-vous en sachant à qui il parle."}
      </p>

      <nav className="mt-6 grid gap-2 sm:grid-cols-2" aria-label="Type de rendez-vous">
        <Link href={`/rdv?type=gratuit${tokenParam}`} aria-current={!paid ? "page" : undefined} className={option + (!paid ? " border-ink bg-ink text-white" : " bg-white")}>
          <span className={"flex items-center gap-1.5 text-[.72rem] font-extrabold tracking-[.1em] uppercase " + (!paid ? "text-[#7be0c8]" : "text-accent")}><Gift className="size-4" aria-hidden />Rendez-vous gratuit · 15 min</span>
          <b className="display mt-1 block text-lg">Premier contact, 0 USD, sans engagement</b>
          <span className={"mt-1 block text-[.88rem] " + (!paid ? "text-[#cbd5df]" : "text-muted")}>Faire le point sur votre profil et décider de la suite.</span>
        </Link>
        <Link href={`/rdv?type=approfondie${tokenParam}`} aria-current={paid ? "page" : undefined} className={option + (paid ? " border-ink bg-ink text-white" : " bg-white")}>
          <span className={"flex items-center gap-1.5 text-[.72rem] font-extrabold tracking-[.1em] uppercase " + (paid ? "text-[#7be0c8]" : "text-accent")}><Lightbulb className="size-4" aria-hidden />Consultation approfondie · payante</span>
          <b className="display mt-1 block text-lg">Une séance avec un plan écrit, tarif selon la durée</b>
          <span className={"mt-1 block text-[.88rem] " + (paid ? "text-[#cbd5df]" : "text-muted")}>Bilan, évolution, reconversion, certification, mentorat.</span>
        </Link>
      </nav>

      <div className="mt-8">{paid ? <PaidSteps format={format} token={token} known={Boolean(lead)} /> : <FreeSlots token={token} known={Boolean(lead)} />}</div>
    </main>
  );
}

/** Free first contact: the slots, then the questionnaire confirms (or the click, for a known prospect). */
async function FreeSlots({ token, known }: { token?: string; known: boolean }) {
  const listing = await listSlots();
  if (!listing.available) return <Closed />;
  return (
    <section>
      <h2 className="flex items-center gap-2 text-xl font-bold"><CalendarCheck className="size-5 shrink-0 text-[var(--color-accent)]" aria-hidden />Rendez-vous gratuit : choisissez votre créneau de 15 minutes</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">Appel vidéo, en français, sans paiement. {known ? "Confirmé dès votre clic." : "Ensuite, votre analyse de profil confirme le rendez-vous."}</p>
      {token && known ? (
        <SlotPicker
          slots={listing.slots.map((s) => s.toISOString())}
          coachTimeZone={listing.coachTimeZone}
          onBook={async ({ start, timezone }) => {
            "use server";
            return bookWithResultToken({ token, start, timezone });
          }}
        />
      ) : (
        <SlotPicker
          slots={listing.slots.map((s) => s.toISOString())}
          coachTimeZone={listing.coachTimeZone}
          submitLabel="Retenir ce créneau, puis mon profil →"
          onBook={async ({ start, timezone }) => {
            "use server";
            return holdSlotThenProfile({ start, timezone });
          }}
        />
      )}
    </section>
  );
}

/** Paid consultation: 1. the format, 2. a slot for it; the palette and the prices come after. */
async function PaidSteps({ format, token, known }: { format?: string; token?: string; known: boolean }) {
  const services = await loadServices().catch(() => []);
  const formats = groupByFormat(services);
  const chosen = format && parseFormatKey(format) ? formats.find((f) => f.key === format) ?? null : null;
  const tokenParam = token ? `&t=${encodeURIComponent(token)}` : "";

  if (formats.length === 0) {
    return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">Les consultations ouvrent bientôt. En attendant, le premier contact de 15 minutes est ouvert.</p>;
  }

  if (!chosen) {
    return (
      <section>
        <h2 className="flex items-center gap-2 text-xl font-bold"><Clock className="size-5 text-[var(--color-accent)]" aria-hidden />1. Quelle durée ?</h2>
        <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">Vous verrez ensuite les créneaux disponibles pour cette durée, puis les séances proposées et leur prix.</p>
        <ul className="grid gap-2">
          {formats.map((f) => (
            <li key={f.key}>
              <Link href={`/rdv?type=approfondie&format=${f.key}${tokenParam}`} className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-white px-4 py-3.5 hover:border-ink">
                <span>
                  <b className="display block text-lg">{f.label}</b>
                  <span className="block text-[.88rem] text-muted">{f.services.join(" · ")}</span>
                </span>
                <span className="shrink-0 font-black">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  const listing = await listSlots(new Date(), { kind: "consulting", sessionMinutes: chosen.sessionMinutes }).catch(() => null);
  return (
    <section>
      <p className="text-sm"><Link href={`/rdv?type=approfondie${tokenParam}`} className="underline underline-offset-4">← Changer de durée</Link></p>
      <h2 className="mt-3 flex items-center gap-2 text-xl font-bold"><CalendarCheck className="size-5 text-[var(--color-accent)]" aria-hidden />2. Un créneau pour {chosen.label}</h2>
      <p className="mt-1 mb-4 text-sm text-[var(--color-muted)]">
        {chosen.sessions > 1 ? "Le créneau de la première séance ; les suivantes se fixent avec Ben. " : ""}Ensuite : la séance et son prix{known ? ", puis le paiement." : ", votre analyse de profil, puis le paiement."}
      </p>
      {!listing || !listing.available ? (
        <Closed />
      ) : (
        <SlotPicker
          slots={listing.slots.map((s) => s.toISOString())}
          coachTimeZone={listing.coachTimeZone}
          submitLabel="Retenir ce créneau, puis choisir la séance →"
          emptyMessage="Aucun créneau de conseil libre dans les cinq prochaines semaines. Réessayez dans quelques jours."
          onBook={async ({ start, timezone }) => {
            "use server";
            return holdConsultingFormatSlot({ format: chosen.key, token, start, timezone });
          }}
        />
      )}
    </section>
  );
}

function Closed() {
  return <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">La réservation est momentanément fermée. Réessayez un peu plus tard.</p>;
}

const option = "block rounded-[18px] border border-line px-4 py-3.5 shadow-[var(--shadow-card)] transition";
