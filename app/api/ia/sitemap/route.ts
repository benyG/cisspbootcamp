import { env } from "@/lib/env";
import { iaOrigin, iaPath } from "@/lib/ia-domain";

export const dynamic = "force-static";

/** sitemap.xml of the IA domain (lib/ia-domain.ts rewrites /sitemap.xml here). */
export function GET() {
  const origin = iaOrigin(env.NEXT_PUBLIC_APP_URL);
  const pages = [
    { path: "/ia", priority: "1.0", freq: "weekly" },
    { path: "/ia/diagnostic", priority: "0.9", freq: "monthly" },
    { path: "/ia/guide", priority: "0.5", freq: "monthly" },
  ];
  const urls = pages.map((p) => `  <url><loc>${origin}${iaPath(p.path)}</loc><changefreq>${p.freq}</changefreq><priority>${p.priority}</priority></url>`).join("\n");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
