"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { liveChat } from "@/config/site";

interface TawkApi {
  onLoad?: () => void;
  onChatMinimized?: () => void;
  maximize?: () => void;
  showWidget?: () => void;
  hideWidget?: () => void;
}

declare global {
  interface Window {
    Tawk_API?: TawkApi;
    Tawk_LoadStart?: Date;
  }
}

/**
 * Live chat (Tawk.to). Our own button sits at the bottom right; Tawk.to is only loaded when a
 * visitor clicks it, so visitors who never chat get no Tawk.to cookies or extra scripts.
 * When the chat window is closed, Tawk.to's own launcher is hidden and our button returns.
 */
export function LiveChat() {
  const [status, setStatus] = useState<"idle" | "loading" | "open" | "ready" | "error">("idle");
  const loaded = useRef(false);

  useEffect(() => {
    if (status !== "error") return;
    const timer = window.setTimeout(() => setStatus("idle"), 6000);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (!liveChat.propertyId || !liveChat.widgetId) return null;

  function open() {
    const api = window.Tawk_API;
    if (loaded.current && api?.maximize) {
      api.showWidget?.();
      api.maximize();
      setStatus("open");
      return;
    }
    setStatus("loading");
    const tawk: TawkApi = window.Tawk_API ?? {};
    tawk.onLoad = () => {
      loaded.current = true;
      tawk.showWidget?.();
      tawk.maximize?.();
      setStatus("open");
    };
    tawk.onChatMinimized = () => {
      tawk.hideWidget?.();
      setStatus("ready");
    };
    window.Tawk_API = tawk;
    window.Tawk_LoadStart = new Date();
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://embed.tawk.to/${encodeURIComponent(liveChat.propertyId)}/${encodeURIComponent(liveChat.widgetId)}`;
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    script.onerror = () => {
      script.remove();
      setStatus("error");
    };
    document.body.appendChild(script);
  }

  if (status === "open") return null;

  return (
    <div className="fixed right-4 bottom-4 z-30 flex flex-col items-end gap-3 md:right-6 md:bottom-6">
      {status === "error" && (
        <p role="alert" className="max-w-64 rounded-2xl bg-white px-4 py-3 text-small text-ink shadow-overlay">
          The chat could not load. Please try again, or use the contact page.
        </p>
      )}
      <button
        type="button"
        onClick={open}
        disabled={status === "loading"}
        aria-label="Chat with us"
        className="group relative flex size-14 items-center justify-center rounded-full bg-brand text-white shadow-[0_10px_28px_rgb(50_23_77/0.35)] transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait md:size-16"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 animate-ping rounded-full bg-brand-light opacity-40 [animation-duration:2.5s] [animation-iteration-count:3] motion-reduce:hidden"
        />
        {status === "loading" ? (
          <Spinner className="size-6" />
        ) : (
          <MessageCircle className="size-6 md:size-7" strokeWidth={1.75} aria-hidden="true" />
        )}
        <span className="pointer-events-none absolute right-full mr-3 hidden rounded-xl bg-white px-3 py-2 text-small font-semibold whitespace-nowrap text-brand shadow-card md:group-hover:block">
          Chat with us
        </span>
      </button>
    </div>
  );
}
