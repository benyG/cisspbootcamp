import { Cloud, Laptop, LifeBuoy, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { IaFooter, IaTopbar } from "@/components/ia/shell";
import { eyebrow, shell } from "@/components/landing/sections";
import { SITE_DEFAULTS, loadSiteSettings } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Préparer sa J1 · Bâtisseur IA",
  description: "Les comptes à créer et l’installation de Claude Code avant la première journée du Bâtisseur IA.",
  robots: { index: false, follow: true },
  openGraph: { title: "Préparer sa J1 · Bâtisseur IA", siteName: "Bâtisseur IA" },
};
export const revalidate = 3600;

/**
 * The installation guide (Ben, 04/11): accounts and tools to have ready
 * before J1. Facts checked on 04/11/2026 against code.claude.com (install
 * commands, plans, cloud sessions) and claude.com/pricing.
 */
export default async function IaGuidePage() {
  const settings = await loadSiteSettings().catch(() => SITE_DEFAULTS);
  const whatsapp = settings.contact.whatsapp ? `https://wa.me/${settings.contact.whatsapp.replace("+", "")}` : null;

  return (
    <>
      <IaTopbar />
      <main className={shell + " grid max-w-[720px] grid-cols-[minmax(0,1fr)] gap-5 pt-2 pb-16"}>
        <div className={eyebrow + " w-fit"}>Avant la J1 · 30 minutes</div>
        <h1 className="display text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.03] font-black tracking-[-.05em]">Préparer votre première journée.</h1>
        <p className="-mt-2 text-ink-2">Trois comptes à créer, puis Claude Code à ouvrir. Faites-le deux ou trois jours avant la J1 : si quelque chose bloque, on a le temps de le régler. La J1 commence directement par votre projet.</p>

        <Step n={1} title="Un abonnement Claude">
          <p>Sur <Ext href="https://claude.ai">claude.ai</Ext>, créez votre compte puis choisissez une offre payante : le plan gratuit ne donne pas accès à Claude Code.</p>
          <ul className="mt-2 grid gap-1.5">
            <li><b>Pro, 20 USD par mois</b> : suffisant pour suivre le bootcamp.</li>
            <li><b>Max, 100 USD par mois</b> : recommandé si vous voulez avancer beaucoup entre les journées.</li>
          </ul>
          <p className="mt-2 text-muted">Un mois d’abonnement couvre les 5 journées si vous les prenez sur des week-ends rapprochés.</p>
        </Step>

        <Step n={2} title="Un compte GitHub, gratuit">
          <p>Sur <Ext href="https://github.com/signup">github.com</Ext>, créez votre compte avec votre e-mail habituel. C’est là que vivra le code de votre application, avec tout son historique.</p>
        </Step>

        <Step n={3} title="Un compte Vercel, gratuit">
          <p>Sur <Ext href="https://vercel.com/signup">vercel.com</Ext>, inscrivez-vous en choisissant <b>« Continue with GitHub »</b>. C’est Vercel qui met votre application en ligne à chaque changement.</p>
          <p className="mt-2 text-muted">Le plan gratuit (Hobby) suffit pour le bootcamp. Le jour où votre application encaisse de l’argent, Vercel demande le plan Pro (20 USD par mois) : on en parle à la J3.</p>
        </Step>

        <Step n={4} title="Ouvrir Claude Code">
          <p>Deux façons, au choix. Si vous hésitez, prenez la première.</p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3">
            <div className="rounded-xl border border-accent bg-accent-soft p-4 text-accent-ink">
              <p className="flex items-center gap-2 font-extrabold"><Cloud className="size-4" aria-hidden />Dans le navigateur, rien à installer</p>
              <ol className="mt-2 grid list-decimal gap-1 pl-5">
                <li>Ouvrez <Ext href="https://claude.ai/code">claude.ai/code</Ext> avec votre compte Claude.</li>
                <li>Connectez votre compte GitHub quand c’est demandé.</li>
                <li>C’est prêt. Claude travaille dans le cloud : la session continue même si votre connexion coupe, et vous la retrouvez aussi dans l’application Claude sur votre téléphone, onglet Code.</li>
              </ol>
            </div>
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="flex items-center gap-2 font-extrabold"><Laptop className="size-4 text-accent" aria-hidden />Sur votre ordinateur</p>
              <p className="mt-2">Le plus simple est l’application de bureau Claude (<Ext href="https://claude.com/download">claude.com/download</Ext>), qui contient Claude Code. Si vous préférez le terminal, copiez la commande de votre système :</p>
              <p className="mt-3 text-[.85rem] font-bold">macOS ou Linux (Terminal)</p>
              <Code>curl -fsSL https://claude.ai/install.sh | bash</Code>
              <p className="mt-3 text-[.85rem] font-bold">Windows (PowerShell)</p>
              <Code>irm https://claude.ai/install.ps1 | iex</Code>
              <p className="mt-3">Fermez le terminal, rouvrez-en un, puis vérifiez :</p>
              <Code>claude --version</Code>
              <p className="mt-2">Un numéro de version s’affiche : c’est installé. Tapez ensuite <code className="rounded bg-slate-100 px-1">claude</code> et connectez-vous avec votre compte Claude dans le navigateur qui s’ouvre.</p>
              <p className="mt-2 text-muted">Sous Windows, installez aussi <Ext href="https://git-scm.com/downloads/win">Git for Windows</Ext> (recommandé). Il faut Windows 10 ou plus récent, macOS 13 ou plus récent, et 4 Go de mémoire.</p>
            </div>
          </div>
        </Step>

        <Step n={5} title="Votre fiche projet">
          <p>Sur votre calendrier personnel (le lien est dans l’e-mail de confirmation de votre place), remplissez la fiche projet : votre activité, les trois tâches à automatiser en premier, vos données. Ben la lit avant la J1 pour que vous démarriez sur votre vrai projet.</p>
        </Step>

        <section className="rounded-[18px] border border-line bg-white p-5">
          <h2 className="flex items-center gap-2 font-extrabold"><ListChecks className="size-5 text-accent" aria-hidden />Le jour de la J1</h2>
          <ul className="mt-2 grid gap-1.5 text-ink-2">
            <li>L’invitation avec le lien de la visio est dans votre agenda ; le rappel arrive la veille par e-mail.</li>
            <li>Ordinateur chargé et branché, connexion stable, casque ou écouteurs.</li>
            <li>Connecté à Claude, GitHub et Vercel avant de commencer.</li>
            <li>Un nom de domaine (environ 10 à 20 USD par an) peut attendre : votre application est d’abord en ligne à une adresse gratuite en .vercel.app.</li>
          </ul>
        </section>

        <section className="rounded-[18px] border border-amber-300 bg-amber-50 p-5 text-amber-950">
          <h2 className="flex items-center gap-2 font-extrabold"><LifeBuoy className="size-5" aria-hidden />Bloqué à une étape ?</h2>
          <p className="mt-1">Répondez simplement à l’e-mail de confirmation de votre place{whatsapp ? <>, ou écrivez à Ben sur <a href={whatsapp} className="underline">WhatsApp</a></> : null}, avec une capture d’écran. Si l’ordinateur n’est pas votre point fort, une séance d’accueil d’une heure avant la J1 installe tout avec vous.</p>
        </section>

        <p className="text-[.85rem] text-muted"><Link href="/ia" className="underline">Le programme des 5 journées</Link></p>
      </main>
      <IaFooter coach={settings.coach.name} />
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex gap-3.5 rounded-[18px] border border-line bg-white p-5">
      <span className="display grid size-9 shrink-0 place-items-center rounded-full bg-ink font-black text-white">{n}</span>
      <div className="min-w-0 flex-1 text-ink-2"><h2 className="mb-1.5 text-[1.1rem] font-extrabold text-ink">{title}</h2>{children}</div>
    </section>
  );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener" className="font-semibold underline underline-offset-2">{children}</a>;
}

function Code({ children }: { children: string }) {
  return <pre className="mt-1.5 overflow-x-auto rounded-lg bg-ink px-3 py-2.5 text-[.85rem] text-white select-all"><code>{children}</code></pre>;
}
