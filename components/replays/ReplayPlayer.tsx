"use client";

import { Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { WATERMARK_MOVE_SECONDS, WATERMARK_SPOTS } from "@/lib/replays";
import { PLAYER_ORIGIN } from "@/lib/stream";

/**
 * The replay player (Ben, 12/10): Cloudflare's player with a signed token,
 * no download, and the viewer's name and e-mail over it. The watermark is
 * faint and only changes margin every 90 seconds, with a slow fade, so it
 * does not distract (Ben's request). The player's own fullscreen and
 * picture-in-picture are off, since they would leave the watermark behind;
 * our fullscreen button takes the player and its watermark together.
 */
export function ReplayPlayer({ token, watermark, title }: { token: string; watermark: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState(0);
  const [visible, setVisible] = useState(true);
  const [canFullscreen, setCanFullscreen] = useState(false);

  useEffect(() => {
    setCanFullscreen(Boolean(box.current?.requestFullscreen));
    const timer = window.setInterval(() => {
      setVisible(false);
      window.setTimeout(() => { setSpot((s) => (s + 1) % WATERMARK_SPOTS.length); setVisible(true); }, 1500);
    }, WATERMARK_MOVE_SECONDS * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const place = WATERMARK_SPOTS[spot];
  return (
    <div>
      <div ref={box} onContextMenu={(e) => e.preventDefault()} className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black select-none">
        <iframe
          src={`${PLAYER_ORIGIN}/${token}?primaryColor=%2317b890&letterboxColor=transparent`}
          title={title}
          allow="accelerometer; gyroscope; autoplay; encrypted-media"
          referrerPolicy="strict-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute text-[11px] font-semibold whitespace-nowrap text-white/35 transition-opacity duration-[1500ms] motion-reduce:transition-none sm:text-xs"
          style={{ top: `${place.top}%`, left: `${place.left}%`, opacity: visible ? 1 : 0, textShadow: "0 1px 2px rgba(0,0,0,.4)" }}
        >
          {watermark}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>Lecture en ligne uniquement. Votre nom apparaît sur la vidéo : elle vous est personnelle.</span>
        {canFullscreen && (
          <button type="button" onClick={() => box.current?.requestFullscreen().catch(() => undefined)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 font-semibold text-ink">
            <Maximize2 className="size-3.5" aria-hidden />Plein écran
          </button>
        )}
      </div>
    </div>
  );
}
