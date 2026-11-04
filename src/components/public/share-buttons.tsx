"use client";

import { Check, Link2, MessageCircle } from "lucide-react";
import { useState } from "react";

/** Copy link + share via WhatsApp (wa.me with pre-filled text; no number is involved). */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            window.prompt("Copy this link:", url);
          }
        }}
        className="inline-flex items-center gap-2 text-small text-ink underline-offset-4 hover:underline"
      >
        {copied ? (
          <Check className="size-4 text-success" aria-hidden="true" />
        ) : (
          <Link2 className="size-4" aria-hidden="true" />
        )}
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </button>
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-small text-ink underline-offset-4 hover:underline"
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        Share on WhatsApp
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </div>
  );
}
