import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

/**
 * Both faces are downloaded at build time and served from our own domain:
 * no request to Google at runtime, which keeps the 3G budget (docs/DESIGN.md).
 */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
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
