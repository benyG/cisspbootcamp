import { Share2 } from "lucide-react";
import Link from "next/link";

import { linkedinRedirectUri, linkedinStatus } from "@/lib/linkedin";

import { disconnectLinkedin, startLinkedinConnect } from "./actions";

export const dynamic = "force-dynamic";

/** Connect the LinkedIn profile the marketing posts are published on (Ben, 03/10). */
export default async function LinkedinSettingsPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const { ok, erreur } = await searchParams;
  const status = await linkedinStatus();
  const fmt = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
      <Link href="/admin" className="text-sm text-muted">← Administration</Link>
      <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Share2 className="size-6 text-accent" aria-hidden />LinkedIn</h1>
      <p className="mt-1 text-sm text-muted">Pour publier les posts de la page Marketing directement sur votre profil LinkedIn.</p>

      {ok && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">LinkedIn connecté.</p>}
      {erreur && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Connexion échouée : {erreur === "configuration" ? "LINKEDIN_CLIENT_ID et LINKEDIN_CLIENT_SECRET ne sont pas encore sur Vercel." : erreur}</p>}

      <section className="mt-6 rounded-xl border border-line bg-white p-4 text-sm">
        {status.state === "not_configured" && (
          <>
            <p className="font-semibold">Application LinkedIn à créer (une fois, 20 minutes)</p>
            <ol className="mt-2 grid list-decimal gap-1 pl-5">
              <li>Sur developer.linkedin.com, « Create app », rattachée à votre page entreprise.</li>
              <li>Onglet Products : ajoutez « Sign In with LinkedIn using OpenID Connect » et « Share on LinkedIn ».</li>
              <li>Onglet Auth, « Authorized redirect URLs » : <code className="rounded bg-slate-100 px-1">{linkedinRedirectUri()}</code></li>
              <li>Sur Vercel, ajoutez <code>LINKEDIN_CLIENT_ID</code> et <code>LINKEDIN_CLIENT_SECRET</code> (onglet Auth de l&apos;application), puis redéployez.</li>
            </ol>
          </>
        )}
        {(status.state === "disconnected" || status.state === "expired") && (
          <>
            <p>{status.state === "expired" ? `La connexion de ${status.name} a expiré (LinkedIn la limite à 60 jours).` : "Aucun profil LinkedIn connecté."}</p>
            <form action={startLinkedinConnect} className="mt-3"><button className={primary}>{status.state === "expired" ? "Reconnecter LinkedIn" : "Connecter LinkedIn"}</button></form>
            <p className="mt-2 text-xs text-muted">Adresse de retour à déclarer dans l&apos;application : {linkedinRedirectUri()}</p>
          </>
        )}
        {status.state === "connected" && (
          <>
            <p>Connecté : <strong>{status.name}</strong>. Valable jusqu&apos;au {fmt(status.expiresAt)}.</p>
            {status.expiresSoon && <p className="mt-2 rounded bg-amber-50 px-2 py-1 text-amber-900">Expire bientôt : reconnectez maintenant pour ne pas être coupé.</p>}
            <div className="mt-3 flex flex-wrap gap-3">
              <form action={startLinkedinConnect}><button className={ghost}>Reconnecter (60 jours de plus)</button></form>
              <form action={disconnectLinkedin}><button className="text-sm text-red-700 underline">Déconnecter</button></form>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

const primary = "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 font-semibold text-white";
const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold";
