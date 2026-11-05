import type { Metadata } from "next";
import { notFound } from "next/navigation";

import Link from "next/link";

import { BriefForm } from "@/components/ia/BriefForm";
import { Planner } from "@/components/ia/Planner";
import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { eyebrow, shell } from "@/components/landing/sections";
import { storedBrief } from "@/lib/ia-brief-schema";
import { planByToken } from "@/lib/ia-plan-server";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";
import { iaPath } from "@/lib/ia-domain";
import { IA_JOURNEES } from "@/lib/ia-days";

export const metadata: Metadata = { title: "Mon calendrier · Bâtisseur IA", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** A participant's calendar (Ben, 03/11): J1 comes with the entry; J2 to J6 are picked here, in order. */
export default async function IaCalendarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [data, settings] = await Promise.all([planByToken(token), loadSiteSettings().catch(() => SITE_DEFAULTS)]);
  if (!data) notFound();
  const done = [1, 2, 3, 4, 5].every((n) => data.held[n]);

  return (
    <>
      <IaTopbar />
      <main className={shell + " grid max-w-[640px] grid-cols-[minmax(0,1fr)] gap-4 pt-2 pb-16"}>
        <div className={eyebrow + " w-fit"}>Mon calendrier</div>
        <h1 className="display text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.04] font-black tracking-[-.05em]">{done ? `${data.plan.lead.firstName}, vos ${IA_JOURNEES} journées sont réservées.` : `${data.plan.lead.firstName}, choisissez vos journées.`}</h1>
        <p className="-mt-1 text-ink-2">Chaque samedi ou dimanche ouvert porte une journée. Prenez la prochaine J2, puis J3, et ainsi de suite jusqu’à la J6, dans l’ordre. Les heures s’affichent dans votre fuseau.</p>
        <section className="rounded-[18px] border border-ink bg-white p-4">
          <h2 className="font-extrabold">Avant la J1</h2>
          <p className="mt-1 text-[.92rem] text-ink-2">Créez vos comptes et ouvrez Claude Code : 30 minutes, deux ou trois jours avant. <Link href={iaPath("/ia/guide")} className="font-bold underline underline-offset-4">Le guide de préparation →</Link></p>
        </section>
        <BriefForm token={token} initial={storedBrief(data.plan.brief)} savedAt={data.plan.briefAt?.toISOString() ?? null} />
        <h2 className="mt-2 text-[1.1rem] font-extrabold">Mes journées</h2>
        <Planner token={token} days={data.days} held={data.held} heldStarts={Object.fromEntries(data.seats.map((seat) => [seat.day.date, seat.day.start]))} nowIso={new Date().toISOString()} />
      </main>
      <IaFooter coach={settings.coach.name} />
    </>
  );
}
