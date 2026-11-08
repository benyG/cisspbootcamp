import { type Pilot, CAMPAIGN_DAYS, forecastSentence, stateLabel } from "@/lib/pilotage";

/**
 * The Monday report (lot 2): one e-mail to Ben, every Monday, with where
 * each cohort stands, last week's funnel and the posts that brought the most
 * visitors. Pure: the cron sends it, the Pilotage page previews it. No clock
 * times, no invented figure: every number comes from the database.
 */

export type ReportCohort = {
  title: string;
  startsAt: Date;
  pilot: Pilot;
  pendingRecent: number;
  held: number;
};

export type ReportInput = {
  now: Date;
  cohorts: ReportCohort[];
  /** Programme name → last week's funnel steps. */
  week: Array<{ program: string; steps: Array<{ unit: string; count: number }> }>;
  posts: Array<{ channel: string; topic: string; visitors: number }>;
  /** Active paid campaigns (lot 8): one line each, from real counts. */
  ads?: Array<{ name: string; verdict: string; text: string }>;
  appUrl: string;
};

const DAY_MS = 86_400_000;
const longDay = (d: Date) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(d);
const dayMonth = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).format(d);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const CHANNEL: Record<string, string> = { linkedin: "LinkedIn", whatsapp_status: "statut WhatsApp", whatsapp_group: "groupe WhatsApp", tiktok: "TikTok", facebook: "Facebook" };

/** The Monday date as YYYY-MM-DD: the report is sent once per week. */
export function reportWeekKey(now: Date): string {
  const day = now.getUTCDay();
  const monday = new Date(now.getTime() - ((day + 6) % 7) * DAY_MS);
  return monday.toISOString().slice(0, 10);
}

export function mondayReport(input: ReportInput): { subject: string; text: string } {
  const base = input.appUrl.replace(/\/$/, "");
  const active = input.cohorts.filter((c) => c.pilot.state !== "not_open");
  const late = active.filter((c) => c.pilot.state === "late").length;
  const subject = `Pilotage du ${longDay(input.now)} : ${active.length ? plural(active.length, "cohorte") + " en campagne" : "aucune cohorte en campagne"}${late ? `, ${late} en retard` : ""}`;

  const cohortLines = input.cohorts.flatMap((c) => {
    const p = c.pilot;
    if (p.state === "not_open") return [`• ${c.title} : campagne ouverte à partir du ${dayMonth(new Date(c.startsAt.getTime() - CAMPAIGN_DAYS * DAY_MS))}.${p.paid ? ` Déjà ${plural(p.paid, "place payée", "places payées")}.` : ""}`, ""];
    const lines = [`• ${c.title} (J${p.day}) : ${plural(p.paid, "place payée", "places payées")} sur ${p.goal}${p.state === "late" || p.state === "on_track" || p.state === "ahead" ? `, ${p.expected} attendue${p.expected > 1 ? "s" : ""} à ce jour` : ""}. ${stateLabel(p)}.`];
    lines.push(`  ${forecastSentence(p)}`);
    const pending = [c.pendingRecent ? plural(c.pendingRecent, "inscription commencée non payée", "inscriptions commencées non payées") : "", c.held ? plural(c.held, "place tenue", "places tenues") : ""].filter(Boolean);
    if (pending.length) lines.push(`  En cours : ${pending.join(", ")}.`);
    return [...lines, ""];
  });

  const weekLines = input.week
    .filter((w) => w.steps.some((s) => s.count > 0))
    .map((w) => `- ${w.program} : ${w.steps.map((s) => `${s.count.toLocaleString("fr-FR")} ${s.unit}`).join(", ")}`);
  const postLines = input.posts.map((p) => `- « ${p.topic} » (${CHANNEL[p.channel] ?? p.channel}) : ${plural(p.visitors, "visite")}`);

  const text = [
    "Bonjour Ben,",
    "",
    input.cohorts.length ? `Où en sont vos cohortes ce ${longDay(input.now)} :` : "Aucune cohorte à venir : créez la prochaine pour lancer sa campagne.",
    "",
    ...cohortLines,
    "La semaine dernière :",
    ...(weekLines.length ? weekLines : ["- Aucune visite mesurée."]),
    "",
    ...(postLines.length ? ["Les publications qui ont amené le plus de visites :", ...postLines, ""] : []),
    ...(input.ads?.length ? ["Pub payante :", ...input.ads.map((a) => `- ${a.name} (${a.verdict}) : ${a.text}`), `  Saisir la dépense : ${base}/admin/publicite`, ""] : []),
    `Le pilotage : ${base}/admin/pilotage`,
    `Votre file d’actions : ${base}/admin`,
  ].join("\n");
  return { subject, text };
}
