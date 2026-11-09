import { list } from "@vercel/blob";

import { fetchBusy, getCredential } from "@/lib/calendar/google";
import { decrypt, loadKey } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { iaDomain } from "@/lib/ia-domain";
import { linkedinConfigured } from "@/lib/linkedin";
import { MARKETING_MODEL } from "@/lib/marketing/ai";

/**
 * Integration health (Ben, 09/11): every outside service the app depends on,
 * tested in one click. Each check is read-only (no e-mail, payment, post or
 * upload) and returns what to do when it fails, in French, for Ben. Secrets
 * are never shown: only whether they are set and whether the service accepts
 * them.
 */

export type Status = "ok" | "warn" | "fail" | "off";
export type CheckResult = { id: string; name: string; role: string; status: Status; detail: string; fix?: string[]; href?: string; ms?: number };
type Check = { id: string; name: string; role: string; href?: string; run: () => Promise<Omit<CheckResult, "id" | "name" | "role">> };

const TIMEOUT_MS = 8_000;
const DAY_MS = 86_400_000;
const set = (name: string) => Boolean(process.env[name]);
const vercelEnv = (names: string[]) => `Vercel › projet cisspbootcamp › Settings › Environment Variables : renseignez ${names.join(", ")} (environnement Production), puis redéployez (Deployments › … › Redeploy).`;
const timed = (url: string, init: RequestInit = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });

export const CHECKS: Check[] = [
  {
    id: "db",
    name: "Base de données",
    role: "Tout le site : prospects, inscriptions, cohortes",
    run: async () => {
      const t = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      const ms = Date.now() - t;
      return ms > 400
        ? { status: "warn", ms, detail: `Répond, mais lentement (${ms} ms).`, fix: ["Vérifiez la charge de la base chez l’hébergeur ; au-delà de 100 ms en continu, activez le cache des pages publiques (CLAUDE.md, Hébergement)."] }
        : { status: "ok", ms, detail: `Répond en ${ms} ms.` };
    },
  },
  {
    id: "admin_login",
    name: "Connexion à l’admin (Google)",
    role: "Votre accès à l’administration",
    run: async () => {
      const missing = ["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"].filter((n) => !set(n));
      return missing.length ? { status: "fail", detail: `Manquant : ${missing.join(", ")}.`, fix: [vercelEnv(missing), "Les identifiants Google viennent de Google Cloud Console › API et services › Identifiants (docs/SETUP-GOOGLE.md)."] } : { status: "ok", detail: "Clés présentes ; vous êtes connecté avec ce compte." };
    },
  },
  {
    id: "calendar",
    name: "Agenda Google",
    role: "Prise de rendez-vous, liens Meet, séances",
    href: "/admin/parametres/google",
    run: async () => {
      if (!set("GOOGLE_TOKEN_ENCRYPTION_KEY")) return { status: "fail", detail: "GOOGLE_TOKEN_ENCRYPTION_KEY manquante : impossible de lire l’accès à l’agenda.", fix: [vercelEnv(["GOOGLE_TOKEN_ENCRYPTION_KEY"])] };
      if (!(await getCredential())) return { status: "fail", detail: "Aucun agenda connecté : la prise de rendez-vous est fermée.", fix: ["Admin › Paramètres › Google › Connecter, avec le compte de votre agenda.", "Au retour, le message vert « Agenda connecté. » confirme la connexion."] };
      const now = new Date();
      await fetchBusy({ start: now, end: new Date(now.getTime() + DAY_MS) });
      return { status: "ok", detail: "L’agenda répond : les créneaux s’affichent." };
    },
  },
  {
    id: "email",
    name: "E-mails (Resend)",
    role: "Résultats, confirmations, relances, rapport du lundi",
    run: async () => {
      if (!set("RESEND_API_KEY")) return { status: "fail", detail: "RESEND_API_KEY manquante : aucun e-mail ne part.", fix: ["resend.com › API Keys › Create API Key (accès « Sending access » suffit).", vercelEnv(["RESEND_API_KEY", "EMAIL_FROM"])] };
      if (!set("EMAIL_FROM")) return { status: "warn", detail: "EMAIL_FROM manquant : l’expéditeur par défaut est utilisé.", fix: [vercelEnv(["EMAIL_FROM"]) + " Exemple : Ben <ben@cisspbootcamp.online>."] };
      const res = await timed("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` } });
      const body = (await res.json().catch(() => null)) as { data?: Array<{ name: string; status: string }>; name?: string; message?: string } | null;
      if (res.status === 401 && /restricted/i.test(`${body?.name} ${body?.message}`)) return { status: "ok", detail: "Clé acceptée (limitée à l’envoi, c’est normal). Pour vérifier la réception, utilisez « M’envoyer un e-mail de test »." };
      if (res.status === 401 || res.status === 403) return { status: "fail", detail: "Resend refuse la clé.", fix: ["resend.com › API Keys : créez une nouvelle clé.", vercelEnv(["RESEND_API_KEY"])] };
      if (!res.ok) return { status: "warn", detail: `Resend a répondu ${res.status}.` };
      const domain = (process.env.EMAIL_FROM ?? "").match(/@([^>\s]+)/)?.[1]?.toLowerCase();
      const found = body?.data?.find((d) => d.name.toLowerCase() === domain);
      if (domain && (!found || found.status !== "verified")) return { status: "fail", detail: `Le domaine ${domain} de EMAIL_FROM n’est pas vérifié chez Resend : les e-mails sont refusés.`, fix: ["resend.com › Domains › Add Domain, puis ajoutez chez Hostinger les enregistrements DNS indiqués (TXT, MX).", "Revenez cliquer « Verify » dans Resend."] };
      return { status: "ok", detail: `Clé acceptée, domaine ${domain ?? "?"} vérifié.` };
    },
  },
  {
    id: "stripe",
    name: "Paiement par carte (Stripe)",
    role: "Inscriptions, soldes, consultations",
    run: async () => {
      if (!set("STRIPE_SECRET_KEY")) return { status: "fail", detail: "STRIPE_SECRET_KEY manquante : le paiement par carte est fermé.", fix: ["dashboard.stripe.com › Développeurs › Clés API : copiez la clé secrète (sk_live_…).", vercelEnv(["STRIPE_SECRET_KEY"])] };
      const res = await timed("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` } });
      if (res.status === 401) return { status: "fail", detail: "Stripe refuse la clé secrète.", fix: ["dashboard.stripe.com › Développeurs › Clés API : régénérez ou recopiez la clé secrète.", vercelEnv(["STRIPE_SECRET_KEY"])] };
      if (!res.ok) return { status: "warn", detail: `Stripe a répondu ${res.status}.` };
      const live = process.env.STRIPE_SECRET_KEY!.startsWith("sk_live_") || process.env.STRIPE_SECRET_KEY!.startsWith("rk_live_");
      if (!set("STRIPE_WEBHOOK_SECRET")) return { status: "fail", detail: "Clé acceptée, mais STRIPE_WEBHOOK_SECRET manquant : un paiement ne serait jamais confirmé.", fix: [`dashboard.stripe.com › Développeurs › Webhooks › Ajouter un endpoint : ${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/api/webhooks/stripe, événement checkout.session.completed.`, "Copiez le « Signing secret » (whsec_…).", vercelEnv(["STRIPE_WEBHOOK_SECRET"])] };
      return live ? { status: "ok", detail: "Clé live acceptée, webhook configuré." } : { status: "warn", detail: "Clé de TEST : aucun vrai paiement n’est encaissé.", fix: ["Quand vous êtes prêt à encaisser : remplacez par la clé live (sk_live_…) et le secret du webhook live.", vercelEnv(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"])] };
    },
  },
  {
    id: "netticket",
    name: "Mobile money (Netticket)",
    role: "Orange Money, MTN MoMo",
    run: async () => {
      if (!set("NETTICKET_API_KEY")) return { status: set("NETTICKET_FALLBACK_URL") ? "warn" : "off", detail: set("NETTICKET_FALLBACK_URL") ? "Pas de clé : seule la page d’achat de secours fonctionne, confirmation manuelle." : "Non configuré : pas de mobile money.", fix: ["Clé fournie par Netticket (docs/NETTICKET.md).", vercelEnv(["NETTICKET_API_KEY", "NETTICKET_WEBHOOK_SECRET"])] };
      const res = await timed("https://netticket.net/api/payment/sante-0/check", { headers: { "x-api-key": process.env.NETTICKET_API_KEY!, Accept: "application/json" } });
      if (res.status === 401 || res.status === 403) return { status: "fail", detail: "Netticket refuse la clé.", fix: ["Demandez une clé valide à Netticket.", vercelEnv(["NETTICKET_API_KEY"])] };
      if (res.status >= 500) return { status: "warn", detail: `Netticket ne répond pas correctement (${res.status}).`, fix: ["Réessayez plus tard ; si cela dure, contactez Netticket. La page de secours reste disponible."] };
      if (!set("NETTICKET_WEBHOOK_SECRET")) return { status: "warn", detail: "Clé acceptée, mais NETTICKET_WEBHOOK_SECRET manquant : les confirmations passent par la vérification régulière seulement.", fix: [vercelEnv(["NETTICKET_WEBHOOK_SECRET"])] };
      return { status: "ok", detail: "Clé acceptée, notification configurée." };
    },
  },
  {
    id: "anthropic",
    name: "IA (Claude)",
    role: "Studio marketing, analyste, messages de relance",
    run: async () => {
      if (!set("ANTHROPIC_API_KEY")) return { status: "fail", detail: "ANTHROPIC_API_KEY manquante : Studio, analyste et rythme de contenu à l’arrêt.", fix: ["console.anthropic.com › API Keys › Create Key.", vercelEnv(["ANTHROPIC_API_KEY"])] };
      const res = await timed(`https://api.anthropic.com/v1/models/${MARKETING_MODEL}`, { headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" } });
      if (res.status === 401 || res.status === 403) return { status: "fail", detail: "Anthropic refuse la clé.", fix: ["console.anthropic.com › API Keys : créez une nouvelle clé.", vercelEnv(["ANTHROPIC_API_KEY"])] };
      if (res.status === 404) return { status: "warn", detail: `Clé acceptée, mais le modèle ${MARKETING_MODEL} n’est pas disponible sur ce compte.` };
      if (!res.ok) return { status: "warn", detail: `Anthropic a répondu ${res.status}.`, fix: ["Vérifiez le crédit du compte : console.anthropic.com › Billing."] };
      return { status: "ok", detail: `Clé acceptée, modèle ${MARKETING_MODEL} disponible.` };
    },
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    role: "Publication programmée, rythme de contenu",
    href: "/admin/parametres/linkedin",
    run: async () => {
      if (!linkedinConfigured()) return { status: "off", detail: "Application LinkedIn non configurée : publication à la main seulement.", fix: ["linkedin.com/developers › votre application › Auth : Client ID et Client Secret.", vercelEnv(["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"])] };
      const credential = await prisma.linkedinCredential.findUnique({ where: { id: 1 } });
      if (!credential) return { status: "warn", detail: "Aucun compte connecté : rien ne se publie seul.", fix: ["Admin › Paramètres › LinkedIn › Connecter."] };
      if (credential.expiresAt <= new Date()) return { status: "fail", detail: "La connexion a expiré : les publications programmées échouent.", fix: ["Admin › Paramètres › LinkedIn › Reconnecter (LinkedIn limite la connexion à 60 jours)."] };
      const token = decrypt(credential.accessTokenSealed, loadKey(env.GOOGLE_TOKEN_ENCRYPTION_KEY));
      const res = await timed("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${token}` } });
      if (res.status === 401) return { status: "fail", detail: "LinkedIn refuse l’accès enregistré.", fix: ["Admin › Paramètres › LinkedIn › Reconnecter."] };
      if (!res.ok) return { status: "warn", detail: `LinkedIn a répondu ${res.status}.` };
      const days = Math.floor((credential.expiresAt.getTime() - Date.now()) / DAY_MS);
      return days < 7 ? { status: "warn", detail: `Connecté (${credential.name}), expire dans ${days} jour${days > 1 ? "s" : ""}.`, fix: ["Admin › Paramètres › LinkedIn › Reconnecter dès maintenant."] } : { status: "ok", detail: `Connecté (${credential.name}), encore ${days} jours.` };
    },
  },
  {
    id: "meta",
    name: "Facebook / Instagram (Meta)",
    role: "Publication sur Facebook",
    run: async () => ({ status: "off", detail: "Pas encore branché : en attente de la validation de l’application par Meta. Publication à la main en attendant." }),
  },
  {
    id: "minimax",
    name: "Images et vidéos (MiniMax)",
    role: "Visuels et vidéos du Studio",
    run: async () => {
      if (!set("MINIMAX_API_KEY")) return { status: "off", detail: "Non configuré : le Studio écrit les prompts, sans générer les visuels.", fix: ["minimax.io › API Keys.", vercelEnv(["MINIMAX_API_KEY"])] };
      const base = (process.env.MINIMAX_BASE_URL ?? "https://api.minimax.io").replace(/\/$/, "");
      const res = await timed(`${base}/v1/files/list?purpose=video_generation`, { headers: { Authorization: `Bearer ${process.env.MINIMAX_API_KEY}` } });
      const body = (await res.json().catch(() => null)) as { base_resp?: { status_code?: number; status_msg?: string } } | null;
      if (res.status === 401 || body?.base_resp?.status_code === 1004) return { status: "fail", detail: "MiniMax refuse la clé.", fix: ["minimax.io › API Keys : créez une nouvelle clé.", vercelEnv(["MINIMAX_API_KEY"])] };
      if (!res.ok || (body?.base_resp?.status_code ?? 0) !== 0) return { status: "warn", detail: `MiniMax : ${body?.base_resp?.status_msg ?? `HTTP ${res.status}`}.`, fix: ["Vérifiez le solde du compte MiniMax."] };
      return { status: "ok", detail: "Clé acceptée." };
    },
  },
  {
    id: "blob",
    name: "Stockage de fichiers (Vercel Blob)",
    role: "Visuels, vidéos, documents, labs",
    run: async () => {
      if (!set("BLOB_READ_WRITE_TOKEN")) return { status: "fail", detail: "BLOB_READ_WRITE_TOKEN manquant : visuels et documents ne s’enregistrent pas.", fix: ["Vercel › projet › Storage › Blob › Connect : la variable est ajoutée seule.", "Redéployez ensuite."] };
      await list({ limit: 1 });
      return { status: "ok", detail: "Le stockage répond." };
    },
  },
  {
    id: "stream",
    name: "Vidéothèque (Cloudflare Stream)",
    role: "Replays des sessions",
    run: async () => {
      if (!set("CLOUDFLARE_ACCOUNT_ID") || !set("CLOUDFLARE_STREAM_TOKEN")) return { status: "off", detail: "Non configuré : pas de replays.", fix: ["dash.cloudflare.com › Stream ; jeton API avec la permission Stream : modifier.", vercelEnv(["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_STREAM_TOKEN"])] };
      const res = await timed(`https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/stream?per_page=1`, { headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_STREAM_TOKEN}` } });
      if (res.status === 401 || res.status === 403) return { status: "fail", detail: "Cloudflare refuse le jeton.", fix: ["dash.cloudflare.com › Mon profil › Jetons API : jeton avec Stream : modifier, sur le bon compte.", vercelEnv(["CLOUDFLARE_STREAM_TOKEN"])] };
      if (!res.ok) return { status: "warn", detail: `Cloudflare a répondu ${res.status}.`, fix: ["Vérifiez CLOUDFLARE_ACCOUNT_ID (dash.cloudflare.com, colonne de droite)."] };
      return { status: "ok", detail: "Jeton accepté." };
    },
  },
  {
    id: "examboot",
    name: "Tests d’entraînement (ExamBoot)",
    role: "Test CISSP de 5 questions",
    run: async () => {
      if (!set("EXAMBOOT_API_KEY") || !set("EXAMBOOT_CISSP_ID")) return { status: "off", detail: "Non configuré : le test renvoie vers l’analyse de profil.", fix: [vercelEnv(["EXAMBOOT_API_KEY", "EXAMBOOT_CISSP_ID", "EXAMBOOT_WEBHOOK_SECRET"])] };
      const base = (process.env.EXAMBOOT_BASE_URL ?? "https://examboot.net").replace(/\/$/, "");
      const res = await timed(base, { method: "HEAD" });
      if (res.status >= 500) return { status: "warn", detail: `ExamBoot ne répond pas correctement (${res.status}).` };
      return set("EXAMBOOT_WEBHOOK_SECRET") ? { status: "ok", detail: "Clés présentes, serveur joignable (la clé est vérifiée au premier test lancé)." } : { status: "warn", detail: "EXAMBOOT_WEBHOOK_SECRET manquant : les résultats arrivent par vérification régulière seulement.", fix: [vercelEnv(["EXAMBOOT_WEBHOOK_SECRET"])] };
    },
  },
  {
    id: "cron",
    name: "Tâches automatiques (Vercel Cron)",
    role: "Rappels, playbooks, rapport du lundi, taux de change",
    run: async () => {
      if (!set("CRON_SECRET")) return { status: "fail", detail: "CRON_SECRET manquant : aucune tâche automatique ne tourne.", fix: ["Choisissez une longue chaîne aléatoire.", vercelEnv(["CRON_SECRET"])] };
      const last = await prisma.exchangeRate.findFirst({ orderBy: { updatedAt: "desc" }, select: { updatedAt: true } });
      if (!last) return { status: "warn", detail: "Aucun taux de change enregistré : la tâche du matin n’a peut-être jamais tourné." };
      const hours = Math.round((Date.now() - last.updatedAt.getTime()) / 3_600_000);
      return hours > 36 ? { status: "fail", detail: `Dernière tâche du matin il y a ${hours} h : les tâches automatiques ne tournent plus.`, fix: ["Vercel › projet › Settings › Cron Jobs : vérifiez qu’elles sont activées.", "Vercel › Logs : cherchez /api/cron/rates et /api/cron/reminders."] } : { status: "ok", detail: `Dernière tâche du matin il y a ${hours} h.` };
    },
  },
  {
    id: "ia_domain",
    name: "Domaine du Bâtisseur IA",
    role: "batisseur-ia.com",
    run: async () => (iaDomain() ? { status: "ok", detail: `Les pages IA répondent sur ${iaDomain()}.` } : { status: "warn", detail: "NEXT_PUBLIC_IA_DOMAIN vide : les pages IA restent sous /ia.", fix: [vercelEnv(["NEXT_PUBLIC_IA_DOMAIN"]) + " Valeur : batisseur-ia.com."] }),
  },
];

/** Runs one check; an exception becomes a failure with its message, never a crash of the page. */
export async function runCheck(check: Check): Promise<CheckResult> {
  const started = Date.now();
  try {
    const out = await check.run();
    return { id: check.id, name: check.name, role: check.role, href: check.href, ms: Date.now() - started, ...out };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timeout = /abort|timeout/i.test(message);
    return {
      id: check.id, name: check.name, role: check.role, href: check.href, status: "fail", ms: Date.now() - started,
      detail: timeout ? `Pas de réponse en ${TIMEOUT_MS / 1000} s.` : message.slice(0, 240),
      fix: check.id === "calendar" ? ["Admin › Paramètres › Google › Déconnecter, puis Connecter.", "Google Cloud Console › API et services › Écran de consentement OAuth : l’application doit être « En production » (sinon l’accès expire au bout de 7 jours)."] : timeout ? ["Réessayez dans un instant ; si cela dure, le service est en panne de son côté."] : undefined,
    };
  }
}

export async function runAllChecks(): Promise<CheckResult[]> {
  return Promise.all(CHECKS.map(runCheck));
}

/** The order of seriousness, for the summary line. */
export function summary(results: CheckResult[]): { fail: number; warn: number; ok: number; off: number } {
  return results.reduce((s, r) => ({ ...s, [r.status]: s[r.status] + 1 }), { fail: 0, warn: 0, ok: 0, off: 0 });
}
