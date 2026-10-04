import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { type ReactNode, Suspense } from "react";

import { ActivityFeedback } from "@/components/ui/ActivityFeedback";

import "./globals.css";

/**
 * Both faces are variable fonts committed in app/fonts and served from our own
 * domain: no request to Google at build or run time, which keeps the 3G budget
 * (docs/DESIGN.md) and removes a network dependency from the Vercel build.
 */
const inter = localFont({
  src: "./fonts/inter-latin.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-inter",
});

const interTight = localFont({
  src: "./fonts/inter-tight-latin.woff2",
  weight: "700 900",
  display: "swap",
  variable: "--font-inter-tight",
});

const DESCRIPTION =
  "Préparez le CISSP en français : 40 h de sessions live sur 15 jours, 8 domaines, questions d’entraînement " +
  "et accompagnement jusqu’à l’examen. Analysez votre profil gratuitement.";

/**
 * Share card and icons (Ben, 04/10): app/opengraph-image.tsx, twitter-image,
 * icon.svg, apple-icon.png and favicon.ico are picked up by Next; the base
 * URL makes their links absolute for the networks.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://www.cisspbootcamp.online"),
  title: "Bootcamp CISSP en français | Préparation intensive CISSP",
  description: DESCRIPTION,
  applicationName: "CISSP Bootcamp",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "CISSP Bootcamp",
    title: "Bootcamp CISSP en français, avec un coach",
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: "Bootcamp CISSP en français, avec un coach", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8f6",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${interTight.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Suspense fallback={null}>
          <ActivityFeedback />
        </Suspense>
        {/* Cookieless page-view counting; no personal data leaves the browser. */}
        <Analytics />
      </body>
    </html>
  );
}
