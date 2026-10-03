import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { BRAND_COLORS as C, CANVAS, PROGRESS_DOTS, SIGNATURE, headlineParts, headlineSize } from "./brand";
import type { Channel } from "./plan";

/**
 * The brand layout on top of a generated photograph (Ben, 03/10), drawn by
 * the app with the site's fonts and colours: night-blue fade for legibility,
 * Inter Tight headline in off-white with one word in green, the 15-dot
 * progress line, "CISSP Bootcamp" bottom left. next/og ships with Next.js,
 * so no new dependency. The fonts are static latin subsets of the site's
 * faces (satori does not read woff2 or variable fonts).
 */

const FONT_DIR = join(process.cwd(), "lib/marketing/fonts");
let fonts: Promise<[Buffer, Buffer]> | null = null;
const loadFonts = () => (fonts ??= Promise.all([readFile(join(FONT_DIR, "inter-tight-800-latin.woff")), readFile(join(FONT_DIR, "inter-600-latin.woff"))]));

export type ComposeInput = { photo: Uint8Array; photoType: string; channel: Channel; headline: string; keyword: string };

export async function composeVisual(input: ComposeInput): Promise<Uint8Array> {
  const { width, height } = CANVAS[input.channel];
  const [display, sans] = await loadFonts();
  const pad = Math.round(width * 0.074);
  const src = `data:${input.photoType};base64,${Buffer.from(input.photo).toString("base64")}`;
  const parts = headlineParts(input.headline, input.keyword);
  const size = headlineSize(input.headline, width);
  const dot = Math.round(width * 0.011);

  const response = new ImageResponse(
    (
      <div style={{ width, height, display: "flex", position: "relative", backgroundColor: C.night }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={src} width={width} height={height} style={{ position: "absolute", top: 0, left: 0, width, height, objectFit: "cover" }} />
        <div style={{ position: "absolute", top: 0, left: 0, width, height, display: "flex", backgroundImage: `linear-gradient(180deg, rgba(7,26,51,0.45) 0%, rgba(7,26,51,0) 22%, rgba(7,26,51,0) 42%, rgba(7,26,51,0.88) 72%, ${C.night} 100%)` }} />
        <div style={{ position: "absolute", left: pad, right: pad, bottom: pad, display: "flex", flexDirection: "column" }}>
          {parts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", columnGap: Math.round(size * 0.24), fontFamily: "Inter Tight", fontWeight: 800, fontSize: size, lineHeight: 1.04, letterSpacing: "-0.04em", color: C.paper, marginBottom: Math.round(width * 0.05) }}>
              {parts.map((p, i) => <span key={i} style={{ color: p.green ? C.green : C.paper }}>{p.text}</span>)}
            </div>
          )}
          <div style={{ display: "flex", position: "relative", alignItems: "center", justifyContent: "space-between", height: dot * 2, marginBottom: Math.round(width * 0.035) }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: dot - 1, height: 2, backgroundColor: C.green, opacity: 0.55 }} />
            {Array.from({ length: PROGRESS_DOTS }, (_, i) => <div key={i} style={{ width: dot, height: dot, borderRadius: dot, backgroundColor: C.green }} />)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "Inter", fontWeight: 600 }}>
            <span style={{ fontSize: Math.round(width * 0.034), color: C.paper, letterSpacing: "-0.01em" }}>{SIGNATURE}</span>
            <span style={{ fontSize: Math.round(width * 0.024), color: C.paper, opacity: 0.7 }}>cisspbootcamp.online</span>
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      fonts: [
        { name: "Inter Tight", data: display, weight: 800, style: "normal" },
        { name: "Inter", data: sans, weight: 600, style: "normal" },
      ],
    },
  );
  return new Uint8Array(await response.arrayBuffer());
}
