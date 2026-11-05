"use client";

import { useEffect, useRef } from "react";
import { publicEnv } from "@/lib/env/client";

/**
 * Cloudflare Turnstile bot check (owner decision: Turnstile on public forms). Usually
 * invisible to people; Cloudflare shows a checkbox only when it is unsure. The widget adds a
 * hidden "cf-turnstile-response" input to the surrounding form, verified on the server.
 * Tokens are single-use: re-key this component after each submission to get a fresh one.
 */
declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function Turnstile({ action }: { action: string }) {
  const container = useRef<HTMLDivElement>(null);
  const siteKey = publicEnv().NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !container.current) return;
    let widgetId: string | null = null;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return;
        widgetId = window.turnstile.render(container.current, {
          sitekey: siteKey,
          action,
          theme: "light",
          size: "flexible",
          "response-field-name": "cf-turnstile-response",
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [siteKey, action]);

  if (!siteKey) return null;
  return <div ref={container} className="min-h-[65px]" />;
}
