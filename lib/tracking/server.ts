import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import { createToken } from "@/lib/tokens";
import { type EventName, isEventName } from "@/lib/tracking/events";

/** First-party visitor cookie: random, 90 days, no personal data. */
export const VISITOR_COOKIE = "cb_v";
export const VISITOR_COOKIE_DAYS = 90;

export function newVisitorId(): string {
  return createToken().slice(0, 32);
}

export type EventInput = {
  name: EventName;
  visitorId?: string | null;
  leadId?: number | null;
  step?: number | null;
  label?: string | null;
  country?: string | null;
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null } | null;
};

const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null);

/**
 * Records one event. Never throws: measurement must not break a sale, so a
 * database hiccup is logged and swallowed. When the event has a lead but no
 * UTM, the lead's first-touch UTM is copied so attribution survives
 * server-side steps (webhooks carry no cookie).
 */
export async function recordEvent(input: EventInput): Promise<void> {
  if (!isEventName(input.name)) return;
  try {
    let utm = input.utm ?? null;
    let country = input.country ?? null;
    if (input.leadId && (!utm || (!utm.source && !utm.medium && !utm.campaign) || !country)) {
      const lead = await prisma.lead.findUnique({
        where: { id: input.leadId },
        select: { utmSource: true, utmMedium: true, utmCampaign: true, country: true },
      });
      if (lead) {
        if (!utm || (!utm.source && !utm.medium && !utm.campaign)) utm = { source: lead.utmSource, medium: lead.utmMedium, campaign: lead.utmCampaign };
        country = country ?? lead.country;
      }
    }
    await prisma.funnelEvent.create({
      data: {
        name: input.name,
        visitorId: clip(input.visitorId, 48),
        leadId: input.leadId ?? null,
        step: input.step ?? null,
        label: clip(input.label, 160),
        country: clip(country, 2),
        utmSource: clip(utm?.source, 120),
        utmMedium: clip(utm?.medium, 120),
        utmCampaign: clip(utm?.campaign, 120),
      },
    });
  } catch (error) {
    console.warn("[tracking] événement non enregistré", input.name, error instanceof Error ? error.message : error);
  }
}

/** The visitor id of the current request, when the browser sent one. */
export async function currentVisitorId(): Promise<string | null> {
  try {
    const jar = await cookies();
    return jar.get(VISITOR_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/** Convenience for server components and actions: current visitor + lead. */
export async function recordServerEvent(input: Omit<EventInput, "visitorId">): Promise<void> {
  await recordEvent({ ...input, visitorId: await currentVisitorId() });
}
