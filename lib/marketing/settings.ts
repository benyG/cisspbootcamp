import { z } from "zod";

import { prisma } from "@/lib/db";

import { DEFAULT_TEST_THRESHOLD } from "./plan";

/**
 * Marketing settings Ben adjusts from the marketing page (Ben, 29/09). Kept
 * in the site_settings table under one key; a missing or invalid row falls
 * back to the defaults.
 */

const KEY = "marketing";

export const marketingSettingsSchema = z.object({
  /** Practice test score, in percent, from which a lead is "test réussi". */
  testThreshold: z.coerce.number().int().min(20).max(100).default(DEFAULT_TEST_THRESHOLD),
});

export type MarketingSettings = z.infer<typeof marketingSettingsSchema>;

export async function loadMarketingSettings(): Promise<MarketingSettings> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KEY } }).catch(() => null);
  const parsed = marketingSettingsSchema.safeParse(row?.value ?? {});
  return parsed.success ? parsed.data : marketingSettingsSchema.parse({});
}

export async function saveMarketingSettings(value: unknown): Promise<MarketingSettings> {
  const parsed = marketingSettingsSchema.parse(value);
  await prisma.siteSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: parsed }, update: { value: parsed } });
  return parsed;
}
