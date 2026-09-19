"use server";

import { prisma } from "@/lib/db";

/**
 * One-click unsubscribe (SPECS A10). The e-mail link lands on a page with a
 * single button rather than acting on GET: mail scanners prefetch links, and
 * a prefetch must never unsubscribe someone.
 */
export async function unsubscribe(token: string): Promise<boolean> {
  const lead = await prisma.lead.findUnique({ where: { unsubscribeToken: token } });
  if (!lead) return false;

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: { unsubscribedAt: lead.unsubscribedAt ?? new Date(), status: "lost" },
    }),
    prisma.actionLog.create({
      data: { leadId: lead.id, type: "unsubscribed", channel: "email" },
    }),
  ]);

  return true;
}
