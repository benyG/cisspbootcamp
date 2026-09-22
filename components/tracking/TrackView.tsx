"use client";

import { useEffect } from "react";

import type { EventName } from "@/lib/tracking/events";
import { track } from "@/lib/tracking/client";

/** Fires one event when the page mounts. Renders nothing. */
export function TrackView({ name, label }: { name: EventName; label?: string }) {
  useEffect(() => {
    track(name, label ? { label } : {});
  }, [name, label]);
  return null;
}
