/**
 * Bâtisseur IA on its own domain (Ben, 04/11). Off until
 * NEXT_PUBLIC_IA_DOMAIN is set (e.g. "batisseur-ia.com"): then the IA pages
 * answer at that domain with clean paths (/, /diagnostic, /inscription…),
 * and /ia/… on the CISSP domain redirects there, so links already sent keep
 * working. Pure and edge-safe: used by the middleware, pages and e-mails.
 */

/** "https://www.Batisseur-IA.com/" → "batisseur-ia.com"; anything invalid → null. */
export function normalizeDomain(value: string | null | undefined): string | null {
  const domain = (value ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) ? domain : null;
}

export function iaDomain(): string | null {
  return normalizeDomain(process.env.NEXT_PUBLIC_IA_DOMAIN);
}

/** A site path of the IA pages ("/ia/diagnostic"), as written on the IA domain ("/diagnostic"). */
export function iaPath(path: string, domain: string | null = iaDomain()): string {
  if (!domain || !/^\/ia(?=$|[/?#])/.test(path)) return path;
  const rest = path.slice(3);
  return rest === "" ? "/" : rest.startsWith("/") ? rest : `/${rest}`;
}

/** Absolute URL of an IA page, for e-mails, Stripe and tracked links. */
export function iaUrl(path: string, appUrl: string, domain: string | null = iaDomain()): string {
  return domain ? `https://${domain}${iaPath(path, domain)}` : `${appUrl.replace(/\/$/, "")}${path}`;
}

/** Where the IA site lives: its own domain, or the CISSP site. */
export function iaOrigin(appUrl: string, domain: string | null = iaDomain()): string {
  return domain ? `https://${domain}` : appUrl.replace(/\/$/, "");
}

/** Pages served as-is on both domains: payment returns, receipts, unsubscribe, privacy, the API. */
const SHARED = [/^\/api\//, /^\/_next\//, /^\/inscription\/(merci|solde\/|recu\/)/, /^\/desinscription\//, /^\/confidentialite$/, /^\/favicon\.ico$/, /^\/icon\.svg$/, /^\/apple-icon\.png$/];

export type IaRoute = { kind: "next" } | { kind: "rewrite"; path: string } | { kind: "redirect"; url: string };

/**
 * What the middleware does with one request. On the IA domain: clean paths
 * are rewritten to /ia/…, /ia/… is served as it is, the admin goes back to
 * the CISSP domain. On the CISSP production domain: /ia/… moves to the IA
 * domain. Previews and localhost are left alone, so /ia keeps working there.
 */
export function iaRoute(input: { host: string; pathname: string; search: string }, config: { iaDomain: string | null; appUrl: string }): IaRoute {
  const domain = config.iaDomain;
  if (!domain) return { kind: "next" };
  const host = input.host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
  const { pathname, search } = input;
  const main = new URL(config.appUrl);
  const mainHost = main.hostname.replace(/^www\./, "");

  if (host === domain) {
    if (pathname.startsWith("/admin")) return { kind: "redirect", url: `${main.origin}${pathname}${search}` };
    if (pathname === "/robots.txt") return { kind: "rewrite", path: "/api/ia/robots" };
    if (pathname === "/sitemap.xml") return { kind: "rewrite", path: "/api/ia/sitemap" };
    if (/^\/ia(?=$|\/)/.test(pathname) || SHARED.some((r) => r.test(pathname))) return { kind: "next" };
    return { kind: "rewrite", path: pathname === "/" ? "/ia" : `/ia${pathname}` };
  }
  if (host === mainHost && /^\/ia(?=$|\/)/.test(pathname)) {
    return { kind: "redirect", url: `https://${domain}${iaPath(pathname, domain)}${search}` };
  }
  return { kind: "next" };
}
