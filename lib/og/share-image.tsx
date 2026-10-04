import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * The site's share image (Ben, 04/10): what LinkedIn, WhatsApp, Facebook
 * and X show for any link to cisspbootcamp.online. The site's colours and
 * fonts, Ben's real photo (docs/DESIGN.md), the offer in one line.
 */

export const SHARE_SIZE = { width: 1200, height: 630 };
export const SHARE_ALT = "CISSP Bootcamp : préparation intensive au CISSP en français, avec Ben, coach CISSP certifié";

const C = { night: "#071A33", night2: "#14324F", paper: "#F7F8F6", green: "#17B890", muted: "#9FB0C2" };
const read = (...p: string[]) => readFile(join(process.cwd(), ...p));

export async function shareImage(): Promise<ImageResponse> {
  const [display, sans, coach] = await Promise.all([
    read("lib/marketing/fonts/inter-tight-800-latin.woff"),
    read("lib/marketing/fonts/inter-600-latin.woff"),
    read("lib/og/coach.png"),
  ]);
  const photo = `data:image/png;base64,${coach.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", position: "relative", backgroundImage: `linear-gradient(135deg, ${C.night} 0%, ${C.night} 55%, ${C.night2} 100%)`, fontFamily: "Inter" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={photo} width={537} height={600} style={{ position: "absolute", right: 30, bottom: 0 }} />
        <div style={{ position: "absolute", left: 72, top: 64, bottom: 64, width: 640, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="52" height="52" viewBox="0 0 64 64">
              <rect width="64" height="64" rx="14" fill="#0B2440" />
              <path d="M44.02 19.98 A17 17 0 1 0 44.02 44.02" fill="none" stroke={C.paper} strokeWidth="7" />
              <circle cx="44.02" cy="19.98" r="5.5" fill={C.green} />
            </svg>
            <span style={{ fontSize: 30, color: C.paper, fontWeight: 600, letterSpacing: "-0.01em" }}>CISSP Bootcamp</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", flexWrap: "wrap", columnGap: 18, fontFamily: "Inter Tight", fontWeight: 800, fontSize: 74, lineHeight: 1.02, letterSpacing: "-0.04em", color: C.paper }}>
              <span>Préparez</span><span>le</span><span style={{ color: C.green }}>CISSP</span><span>en</span><span>français,</span><span>avec</span><span>un</span><span>coach.</span>
            </div>
            <span style={{ fontSize: 26, color: C.muted, lineHeight: 1.4, maxWidth: 600 }}>40 h de sessions live sur 15 jours · les 8 domaines · analyse de profil gratuite</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", position: "relative", alignItems: "center", justifyContent: "space-between", width: 520, height: 14 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 6, height: 2, backgroundColor: C.green, opacity: 0.55 }} />
              {Array.from({ length: 15 }, (_, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 12, backgroundColor: C.green }} />)}
            </div>
            <span style={{ fontSize: 26, color: C.paper, fontWeight: 600 }}>cisspbootcamp.online</span>
          </div>
        </div>
      </div>
    ),
    { ...SHARE_SIZE, fonts: [{ name: "Inter Tight", data: display, weight: 800, style: "normal" }, { name: "Inter", data: sans, weight: 600, style: "normal" }] },
  );
}
