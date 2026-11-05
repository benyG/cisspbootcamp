import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SHARE_SIZE } from "@/lib/og/share-image";

/** Bâtisseur IA share image: same colours, fonts and photo as the site's, its own promise. */
export const IA_SHARE_ALT = "Bâtisseur IA : construisez votre application en 6 journées avec Claude Code, avec Ben";

const C = { night: "#071A33", night2: "#14324F", paper: "#F7F8F6", green: "#17B890", muted: "#9FB0C2" };
const read = (...p: string[]) => readFile(join(process.cwd(), ...p));

export async function iaShareImage(): Promise<ImageResponse> {
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
        <div style={{ position: "absolute", left: 72, top: 64, bottom: 64, width: 660, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <span style={{ fontSize: 30, color: C.paper, fontWeight: 600 }}>Bâtisseur IA</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", flexWrap: "wrap", columnGap: 18, fontFamily: "Inter Tight", fontWeight: 800, fontSize: 68, lineHeight: 1.04, letterSpacing: "-0.04em", color: C.paper }}>
              <span>Votre</span><span>application</span><span>en</span><span>ligne</span><span>en</span><span style={{ color: C.green }}>5</span><span style={{ color: C.green }}>journées.</span>
            </div>
            <span style={{ fontSize: 26, color: C.muted, lineHeight: 1.4, maxWidth: 620 }}>Avec Claude Code · le week-end · en français · pas besoin de savoir coder</span>
          </div>
          <div style={{ display: "flex", gap: 14 }}>
            {[1, 2, 3, 4, 5].map((n) => <div key={n} style={{ display: "flex", width: 64, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: n === 1 ? C.green : "#0B2440", color: C.paper, fontSize: 22, fontWeight: 600 }}>J{n}</div>)}
          </div>
        </div>
      </div>
    ),
    { ...SHARE_SIZE, fonts: [{ name: "Inter Tight", data: display, weight: 800, style: "normal" }, { name: "Inter", data: sans, weight: 600, style: "normal" }] },
  );
}
