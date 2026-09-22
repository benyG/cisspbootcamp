"use client";

import type { EventName } from "@/lib/tracking/events";

/**
 * Browser side of the funnel measurement: one POST per event to our own API,
 * fire-and-forget. First-touch UTM parameters are kept in localStorage so a
 * visitor who comes back direct is still attributed to the campaign.
 */
const UTM_KEY = "cb_utm";

type Utm = { source?: string; medium?: string; campaign?: string };

export function rememberUtm(): Utm {
  try {
    const params = new URLSearchParams(window.location.search);
    const fresh: Utm = {};
    const source = params.get("utm_source");
    const medium = params.get("utm_medium");
    const campaign = params.get("utm_campaign");
    if (source) fresh.source = source;
    if (medium) fresh.medium = medium;
    if (campaign) fresh.campaign = campaign;
    const stored = JSON.parse(localStorage.getItem(UTM_KEY) ?? "null") as Utm | null;
    if (stored && Object.keys(stored).length > 0) return stored;
    if (Object.keys(fresh).length > 0) localStorage.setItem(UTM_KEY, JSON.stringify(fresh));
    return fresh;
  } catch {
    return {};
  }
}

export function track(name: EventName, props: { step?: number; label?: string } = {}): void {
  try {
    const body = JSON.stringify({ name, ...props, utm: rememberUtm(), path: window.location.pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
    }
  } catch {
    /* measurement never breaks the page */
  }
}
