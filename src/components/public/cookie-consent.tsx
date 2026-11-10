"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { recordConsentAction } from "@/features/cookies/actions";
import { CONSENT_COOKIE, CONSENT_MAX_AGE, type Consent, formatConsent, parseConsent } from "@/features/cookies/consent";

/**
 * Cookie notice and first-party visit statistics. Statistics start only after "Accept", stop
 * immediately on "Essential only", and the choice can be changed from the footer link.
 */
const OPEN_EVENT = "vl:cookie-settings";
const CHANGE_EVENT = "vl:consent-changed";

function readConsent(): Consent | null {
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  return parseConsent(raw);
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Cookie value as a string, so useSyncExternalStore compares by value. */
function useConsentCookie(): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => {
      const c = readConsent();
      return c ? formatConsent(c) : null;
    },
    () => undefined, // server render: unknown
  );
}

function saveConsent(consent: Consent) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${formatConsent(consent)}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  window.dispatchEvent(new Event(CHANGE_EVENT));
  void recordConsentAction(consent.anonId, consent.analytics, consent.version).catch(() => {});
}

function sessionId(): string {
  try {
    let id = window.sessionStorage.getItem("vl_sid");
    if (!id) {
      id = crypto.randomUUID();
      window.sessionStorage.setItem("vl_sid", id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function send(type: "page_view" | "whatsapp_click" | "phone_click", path: string) {
  const params = new URLSearchParams(window.location.search);
  const body = JSON.stringify({
    sid: sessionId(),
    type,
    path,
    ref: document.referrer || null,
    utm: { source: params.get("utm_source"), medium: params.get("utm_medium"), campaign: params.get("utm_campaign") },
  });
  try {
    if (!navigator.sendBeacon?.("/api/analytics", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/analytics", {
        method: "POST",
        body,
        keepalive: true,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    // Statistics are best effort.
  }
}

export function CookieConsent({
  notice,
  analyticsDescription,
  policyVersion,
  analyticsEnabled,
}: {
  notice: string;
  analyticsDescription: string;
  policyVersion: string;
  analyticsEnabled: boolean;
}) {
  const cookie = useConsentCookie();
  const consent = cookie ? parseConsent(cookie) : null;
  const current = consent?.version === policyVersion ? consent : null;
  const [reopened, setReopened] = useState(false);
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);
  const tracking = analyticsEnabled && current?.analytics === true;

  useEffect(() => {
    const open = () => setReopened(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  // One page view per page; nothing at all without consent.
  useEffect(() => {
    if (!tracking || lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    send("page_view", pathname);
  }, [tracking, pathname]);

  // WhatsApp and phone link clicks.
  useEffect(() => {
    if (!tracking) return;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      const href = link?.getAttribute("href") ?? "";
      if (/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)) send("whatsapp_click", window.location.pathname);
      else if (href.startsWith("tel:")) send("phone_click", window.location.pathname);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [tracking]);

  // Without statistics there are no optional cookies, so there is nothing to ask.
  if (!analyticsEnabled || cookie === undefined) return null; // undefined: first render, wait for the browser
  if (current && !reopened) return null;

  const choose = (analytics: boolean) => {
    saveConsent({ version: policyVersion, analytics, anonId: consent?.anonId ?? crypto.randomUUID() });
    setReopened(false);
  };

  return (
    <section
      aria-label="Cookie choice"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper shadow-[0_-8px_24px_rgba(50,23,77,0.08)]"
    >
      <div className="container-content flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between md:gap-8">
        <div className="flex max-w-3xl flex-col gap-2">
          <p className="text-small text-ink">{notice}</p>
          <p className="text-caption text-stone">{analyticsDescription}</p>
          <Link href="/privacy-policy" className="text-caption text-brand underline underline-offset-4">
            Read our privacy policy
          </Link>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          <Button variant="secondary" onClick={() => choose(false)}>
            Essential only
          </Button>
          <Button onClick={() => choose(true)}>Accept statistics</Button>
        </div>
      </div>
    </section>
  );
}

/** Footer link that reopens the cookie choice. */
export function CookieSettingsLink({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      Cookie settings
    </button>
  );
}
