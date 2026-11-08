"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** On phones, the hero's action (book a seat, Ben 08/11) stays a thumb away once its button has scrolled out of view. */
export function Dock({ href, watch, title, sub, action }: { href: string; watch: string; title: string; sub: string; action: string }) {
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
      <p><b>{title}</b>{sub}</p>
      <Link className="btn btn-go btn-sm" href={href} tabIndex={on ? 0 : -1}>{action}</Link>
    </div>
  );
}
