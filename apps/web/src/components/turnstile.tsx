"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void; remove: (id: string) => void };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. Most visitors never see a challenge. */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;
    const mount = () => {
      if (!ref.current || !window.turnstile || id.current) return;
      id.current = window.turnstile.render(ref.current, {
        sitekey: SITE_KEY,
        size: "flexible",
        appearance: "interaction-only",
        theme: document.documentElement.dataset.theme === "light" ? "light" : "dark",
        callback: onToken,
        "expired-callback": () => onToken(""),
      });
    };
    const timer = setInterval(() => {
      if (window.turnstile) {
        mount();
        clearInterval(timer);
      }
    }, 200);
    return () => {
      clearInterval(timer);
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
  }, [onToken]);

  if (!SITE_KEY) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" />
      <div ref={ref} className="mt-3" />
    </>
  );
}
