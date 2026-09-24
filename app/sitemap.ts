import type { MetadataRoute } from "next";

import { env } from "@/lib/env";
import { SERVICE_CODES } from "@/lib/services";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_APP_URL;
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/conseil`, changeFrequency: "monthly", priority: 0.8 },
    ...SERVICE_CODES.map((code) => ({ url: `${base}/conseil/${code}`, changeFrequency: "monthly" as const, priority: 0.6 })),
    { url: `${base}/rdv`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/confidentialite`, changeFrequency: "yearly", priority: 0.1 },
  ];
}
