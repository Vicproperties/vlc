import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Simple line drawings of the social networks accepted in Website Settings and on team
 * members (the icon library has no brand marks). Decorative: the link carries the label.
 */
const ICONS: Record<string, ReactNode> = {
  facebook: (
    <path
      fill="currentColor"
      stroke="none"
      d="M13.5 21v-7.5h2.6l.4-3.1h-3V8.5c0-.9.3-1.5 1.6-1.5h1.6V4.2c-.3 0-1.2-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.2H7.7v3.1h2.6V21z"
    />
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 10.5V16.5" />
      <circle cx="8" cy="7.6" r="0.9" fill="currentColor" stroke="none" />
      <path d="M11.5 16.5v-6M11.5 13c0-1.6 1-2.6 2.4-2.6s2.1.9 2.1 2.6v3.5" />
    </>
  ),
  x: (
    <>
      <path d="M4.5 4h4l11 16h-4z" />
      <path d="M19.5 4l-6.4 7M4.5 20l6.4-7" />
    </>
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.2 9.2v5.6l4.8-2.8z" fill="currentColor" />
    </>
  ),
  tiktok: (
    <>
      <path d="M14 3.5v11a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M14 3.5c.4 2.4 2.2 4.1 5 4.3" />
    </>
  ),
};

export const SOCIAL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
  tiktok: "TikTok",
};

export function SocialIcon({ network, className }: { network: string; className?: string }) {
  const icon = ICONS[network];
  if (!icon) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-4", className)}
    >
      {icon}
    </svg>
  );
}

/** Round icon links. `who` completes the accessible name, e.g. "LinkedIn profile of Ada". */
export function SocialLinks({
  links,
  who,
  tone = "light",
  className,
}: {
  links: Array<[network: string, url: string]>;
  who?: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const shown = links.filter(([network, url]) => ICONS[network] && /^https:\/\//.test(url));
  if (!shown.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-2", className)} aria-label={who ? `${who} on social media` : "Social media"}>
      {shown.map(([network, url]) => (
        <li key={network}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex size-9 items-center justify-center rounded-full transition-colors duration-200",
              tone === "light"
                ? "border border-line bg-white text-brand hover:border-brand hover:bg-brand hover:text-white"
                : "bg-white/10 text-white hover:bg-brand-light hover:text-brand",
            )}
          >
            <SocialIcon network={network} />
            <span className="sr-only">
              {SOCIAL_LABELS[network]}
              {who ? ` profile of ${who}` : ""} (opens in a new tab)
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
