"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Every click must visibly do something (Ben, 27/09). Mounted once in the
 * root layout, this marks the button of a submitted form as pending (spinner,
 * no second click) and shows a thin bar at the top of the page while a
 * server action or a page change is on its way. Nothing to wire per form.
 */
export function ActivityFeedback() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [busy, setBusy] = useState(false);
  const inflight = useRef(0);
  const settle = useRef<number | undefined>(undefined);

  // A page change ends whatever was pending.
  useEffect(() => {
    if (inflight.current === 0) clearPending(setBusy);
  }, [pathname, search]);

  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      const button = (event.submitter as HTMLElement | null) ?? form?.querySelector<HTMLElement>('button[type="submit"], button:not([type])');
      if (button) {
        button.setAttribute("data-pending", "true");
        button.setAttribute("aria-busy", "true");
      }
      setBusy(true);
      // A form handled entirely in the browser starts no request: release it soon.
      window.clearTimeout(settle.current);
      settle.current = window.setTimeout(() => {
        if (inflight.current === 0) clearPending(setBusy);
      }, 1200);
    };

    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const tracked = isTracked(args[0], args[1]);
      if (tracked) {
        inflight.current++;
        setBusy(true);
      }
      try {
        return await original(...args);
      } finally {
        if (tracked) {
          inflight.current = Math.max(0, inflight.current - 1);
          if (inflight.current === 0) window.setTimeout(() => inflight.current === 0 && clearPending(setBusy), 60);
        }
      }
    };

    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      window.fetch = original;
    };
  }, []);

  return <div aria-hidden className="activity-bar" data-active={busy ? "true" : "false"} />;
}

function clearPending(setBusy: (busy: boolean) => void) {
  document.querySelectorAll("[data-pending]").forEach((el) => {
    el.removeAttribute("data-pending");
    el.removeAttribute("aria-busy");
  });
  setBusy(false);
}

/** Server actions and page changes; never background prefetches. */
function isTracked(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (headers.has("next-router-prefetch")) return false;
  return headers.has("next-action") || headers.has("rsc");
}
