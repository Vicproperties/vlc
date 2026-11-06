"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { buttonClasses } from "@/components/ui/button";
import type { PublicAnnouncement, PublicBanner } from "@/features/marketing/queries";
import { type NewsletterState, subscribeAction } from "@/features/newsletter/actions";
import { cn } from "@/lib/cn";

/** Storage can be blocked (private mode, settings): treat every failure as "nothing stored". */
function read(storage: "local" | "session", key: string): string | null {
  try {
    return (storage === "local" ? window.localStorage : window.sessionStorage).getItem(key);
  } catch {
    return null;
  }
}
function write(storage: "local" | "session", key: string, value: string) {
  try {
    (storage === "local" ? window.localStorage : window.sessionStorage).setItem(key, value);
  } catch {
    // Not remembered: the visitor may see it again, which is harmless.
  }
}

const noopSubscribe = () => () => {};
/** True only in the browser after hydration (server and first client render agree on false). */
function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

const bannerTone: Record<PublicBanner["type"], string> = {
  information: "bg-brand-tint text-ink",
  promotion: "bg-brand text-white",
  notice: "bg-ink text-white",
};

/** Thin strip above the header. Closing it hides it for the rest of the visit. */
export function TopBannerBar({ banner }: { banner: PublicBanner }) {
  const hydrated = useHydrated();
  const key = `vl-banner-closed:${banner.id}`;
  const [closed, setClosed] = useState(false);
  if (closed || (hydrated && read("session", key))) return null;

  const content = (
    <>
      {banner.message}
      {banner.ctaLabel && <span className="ml-2 font-semibold underline underline-offset-4">{banner.ctaLabel}</span>}
    </>
  );
  return (
    <div className={cn("relative", bannerTone[banner.type])} role="region" aria-label="Site notice">
      <p className="container-content py-2.5 pr-12 text-center text-small">
        {banner.linkUrl ? (
          <Link href={banner.linkUrl} className="hover:underline">
            {content}
          </Link>
        ) : (
          content
        )}
      </p>
      <button
        type="button"
        onClick={() => {
          write("session", key, "1");
          setClosed(true);
        }}
        className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center opacity-80 hover:opacity-100"
        aria-label="Close notice"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Should this visitor see this version of the announcement now? */
function due(a: PublicAnnouncement): boolean {
  const key = `vl-announcement:${a.id}:${a.version}`;
  if (a.frequency === "once_per_session") return !read("session", key);
  const last = Number(read("local", key) ?? "0");
  if (!last) return true;
  if (a.frequency === "once") return false;
  return Date.now() - last > (a.frequencyDays ?? 1) * 86_400_000;
}

function remember(a: PublicAnnouncement) {
  const key = `vl-announcement:${a.id}:${a.version}`;
  if (a.frequency === "once_per_session") write("session", key, "1");
  else write("local", key, String(Date.now()));
}

/** Pop-up announcement, shown after a short delay and at most as often as the admin chose. */
export function AnnouncementPopup({ announcement }: { announcement: PublicAnnouncement }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!due(announcement)) return;
    const timer = window.setTimeout(() => {
      remember(announcement);
      setOpen(true);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [announcement]);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      title={announcement.heading}
      description={announcement.message ?? undefined}
      footer={
        announcement.ctaLabel && announcement.ctaUrl ? (
          <Link href={announcement.ctaUrl} className={buttonClasses("primary", "md")} onClick={() => setOpen(false)}>
            {announcement.ctaLabel}
          </Link>
        ) : undefined
      }
    >
      {announcement.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- already resized WebP from our storage
        <img src={announcement.imageUrl} alt={announcement.imageAlt} className="max-h-72 w-full object-cover" />
      )}
    </Dialog>
  );
}

/** Footer newsletter sign-up (double opt-in: the email link activates it). */
export function NewsletterSignup({ source = "footer" }: { source?: string }) {
  const [state, action, pending] = useActionState<NewsletterState, FormData>(subscribeAction, { status: "idle" });
  if (state.status === "success") {
    return (
      <p role="status" className="text-small text-white/90">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="newsletter-email" className="text-small text-white/90">
        Property news and offers by email. Unsubscribe at any time.
      </label>
      {/* Honeypot: hidden from people, filled in by bots. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <input type="hidden" name="source" value={source} />
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="Your email address"
          className="h-11 min-w-0 flex-1 border border-white/40 bg-white/10 px-3 text-small text-white placeholder:text-white/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          aria-describedby={state.status === "error" ? "newsletter-error" : undefined}
        />
        <button
          type="submit"
          disabled={pending}
          className="h-11 shrink-0 bg-white px-4 text-small font-semibold text-brand-deep hover:bg-brand-tint disabled:opacity-60"
        >
          {pending ? "Sending" : "Subscribe"}
        </button>
      </div>
      {state.status === "error" && (
        <p id="newsletter-error" role="alert" className="text-caption text-white">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Confirm or unsubscribe only on a click, so email link scanners cannot do it. */
export function NewsletterLinkButton({
  run,
  label,
}: {
  run: () => Promise<{ ok: boolean; message: string }>;
  label: string;
}) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  if (result) {
    return (
      <p role={result.ok ? "status" : "alert"} className={cn("text-small", result.ok ? "text-ink" : "text-danger")}>
        {result.message}
      </p>
    );
  }
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClasses("primary", "md")}
      onClick={async () => {
        setPending(true);
        try {
          setResult(await run());
        } finally {
          setPending(false);
        }
      }}
    >
      {label}
    </button>
  );
}
