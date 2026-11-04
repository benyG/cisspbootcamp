import type { Metadata } from "next";
import type { ReactNode } from "react";

import { env } from "@/lib/env";
import { iaOrigin } from "@/lib/ia-domain";

/** Share cards and canonical links of the IA pages point to their own domain once it is set (lib/ia-domain.ts). */
export const metadata: Metadata = {
  metadataBase: new URL(iaOrigin(env.NEXT_PUBLIC_APP_URL)),
  applicationName: "Bâtisseur IA",
};

export default function IaLayout({ children }: { children: ReactNode }) {
  return children;
}
