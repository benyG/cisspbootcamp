import type { MetadataRoute } from "next";

import { env } from "@/lib/env";

/** The admin and the private token pages are never indexed; the rest is. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/rdv/", "/scanner/resultat/", "/conseil/rdv/", "/inscription/recu/", "/desinscription/"] }],
    sitemap: `${env.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
