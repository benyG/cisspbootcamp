import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";

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

export const metadata: Metadata = {
  title: "CISSP Bootcamp — Ne préparez plus le CISSP au hasard",
  description:
    "Bootcamp CISSP de 40 h sur 15 jours, en français, avec un coach certifié. " +
    "Analysez votre profil en 3 minutes : éligibilité ISC², domaines, délai réaliste.",
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
        {/* Cookieless page-view counting; no personal data leaves the browser. */}
        <Analytics />
      </body>
    </html>
  );
}
