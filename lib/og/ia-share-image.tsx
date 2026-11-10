import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { IA_COMPANY } from "@/lib/ia-brand";
import { JOURNEES } from "@/lib/ia-days";
import { SHARE_SIZE } from "@/lib/og/share-image";

/**
 * Bâtisseur IA share image: the site's colours and fonts, its own promise
 * (the autonomous business, Ben 08/11),
 * the six journées, signed ExamBoot. No portrait: the IA side speaks for the
 * company, not for Ben (05/11).
 */
export const IA_SHARE_ALT = `Bâtisseur IA : bâtissez votre entreprise autonome avec l’IA, formation bootcamp en ${JOURNEES.length} journées en direct, par ${IA_COMPANY}`;

const C = { night: "#071A33", night2: "#14324F", panel: "#0B2440", paper: "#F7F8F6", green: "#17B890", muted: "#9FB0C2" };
const read = (...p: string[]) => readFile(join(process.cwd(), ...p));

/** Short names of the journées, as on the share card. */
const SHORT = ["Composantes de l’IA", "Processus et fondations", "Activité et données", "Système d’agents", "Agents spécialisés", "Pilotage autonome"] as const;

export async function iaShareImage(): Promise<ImageResponse> {
  const [display, sans] = await Promise.all([
    read("lib/marketing/fonts/inter-tight-800-latin.woff"),
    read("lib/marketing/fonts/inter-600-latin.woff"),
  ]);
  const days = JOURNEES.map((j, i) => ({ n: j.n, label: SHORT[i] ?? j.title }));
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", position: "relative", backgroundImage: `linear-gradient(135deg, ${C.night} 0%, ${C.night} 55%, ${C.night2} 100%)`, fontFamily: "Inter" }}>
        <div style={{ position: "absolute", left: 64, top: 56, bottom: 56, width: 600, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: 20, color: C.green, fontWeight: 600, letterSpacing: "0.04em" }}>FORMATION BOOTCAMP · EN DIRECT · EN FRANÇAIS</span>
          <div style={{ display: "flex", flexWrap: "wrap", columnGap: 16, fontFamily: "Inter Tight", fontWeight: 800, fontSize: 64, lineHeight: 1.04, letterSpacing: "-0.04em", color: C.paper }}>
            {["Bâtissez", "votre", "entreprise"].map((w) => <span key={w}>{w}</span>)}
            <span style={{ color: C.green }}>autonome</span>
            {["avec", "l’IA."].map((w) => <span key={w}>{w}</span>)}
          </div>
          <span style={{ fontSize: 23, color: C.muted, lineHeight: 1.4 }}>Elle vend, encaisse, communique · vous gardez les commandes</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 30, color: C.paper, fontWeight: 600 }}>Bâtisseur IA</span>
            <span style={{ fontSize: 22, color: C.muted }}>{`Une formation ${IA_COMPANY} · batisseur-ia.com`}</span>
          </div>
        </div>
        <div style={{ position: "absolute", right: 56, top: 56, bottom: 56, width: 470, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
          {days.map((d) => (
            <div key={d.n} style={{ display: "flex", alignItems: "center", gap: 16, backgroundColor: C.panel, borderRadius: 14, padding: "14px 18px" }}>
              <span style={{ fontFamily: "Inter Tight", fontWeight: 800, fontSize: 30, color: C.green, width: 48 }}>{`J${d.n}`}</span>
              <span style={{ fontSize: 21, color: C.paper }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...SHARE_SIZE, fonts: [{ name: "Inter Tight", data: display, weight: 800, style: "normal" }, { name: "Inter", data: sans, weight: 600, style: "normal" }] },
  );
}
