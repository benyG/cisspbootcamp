import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "CISSP Bootcamp — Coaching CISSP en français",
  description:
    "Bootcamp CISSP de 40 h en français : diagnostic de profil, accompagnement " +
    "par un coach certifié CISSP, jusqu'à l'examen.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
