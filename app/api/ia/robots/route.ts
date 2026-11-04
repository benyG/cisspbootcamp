import { env } from "@/lib/env";
import { iaOrigin } from "@/lib/ia-domain";

export const dynamic = "force-static";

/** robots.txt of the IA domain (lib/ia-domain.ts rewrites /robots.txt here): personal pages are never indexed. */
export function GET() {
  const origin = iaOrigin(env.NEXT_PUBLIC_APP_URL);
  const body = ["User-agent: *", "Allow: /", "Disallow: /calendrier/", "Disallow: /diagnostic/resultat/", "Disallow: /inscription/", "Disallow: /desinscription/", "Disallow: /api/", "", `Sitemap: ${origin}/sitemap.xml`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
