import type { Metadata } from "next";
import type { ReactNode } from "react";

import { env } from "@/lib/env";
import { iaOrigin } from "@/lib/ia-domain";

import { iaFontVariables } from "./fonts";

/** Share cards and canonical links of the IA pages point to their own domain once it is set (lib/ia-domain.ts). */
export const metadata: Metadata = {
  metadataBase: new URL(iaOrigin(env.NEXT_PUBLIC_APP_URL)),
  applicationName: "Bâtisseur IA",
};

/** The IA faces are available to every IA page; `contents` keeps the page layout as it was. */
export default function IaLayout({ children }: { children: ReactNode }) {
  return <div className={`${iaFontVariables} contents`}>{children}</div>;
}
