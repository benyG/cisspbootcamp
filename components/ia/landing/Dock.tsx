"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** On phones, the diagnostic stays a thumb away once the hero's button has scrolled out of view. */
export function Dock({ href, watch }: { href: string; watch: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const target = document.getElementById(watch);
    if (!target || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([entry]) => setOn(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    io.observe(target);
    return () => io.disconnect();
  }, [watch]);
  return (
    <div className={"dock" + (on ? " on" : "")} aria-hidden={!on}>
      <p><b>Diagnostic gratuit</b>3 minutes, résultat immédiat</p>
      <Link className="btn btn-go btn-sm" href={href} tabIndex={on ? 0 : -1}>Commencer</Link>
    </div>
  );
}
