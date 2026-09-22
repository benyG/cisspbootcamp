"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import type { EventName } from "@/lib/tracking/events";
import { track } from "@/lib/tracking/client";

type Props = ComponentProps<typeof Link> & { event?: EventName; label: string };

/** A link that records where the click came from (hero, price, video…). */
export function TrackLink({ event = "cta_click", label, onClick, ...rest }: Props) {
  return (
    <Link
      {...rest}
      onClick={(e) => {
        track(event, { label });
        onClick?.(e);
      }}
    />
  );
}
