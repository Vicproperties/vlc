import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Supabase project origin (public). Images are served from Storage; the browser client
// (customer favourites, Stage 10) talks to the API and Realtime.
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : "";
  } catch {
    return "";
  }
})();
const supabaseWs = supabaseOrigin.replace(/^https:/, "wss:");

/**
 * Baseline Content Security Policy (static, so public pages stay cacheable).
 * Sources are added explicitly as integrations arrive:
 *   - Supabase (connect/img) in Stage 3
 *   - Cloudflare Turnstile (script/frame) in Stage 7 — added
 *   - YouTube embeds (frame: youtube-nocookie.com) in Stage 6
 *   - Tawk.to live chat (loaded only when a visitor opens the chat): *.tawk.to, and
 *     cdn.jsdelivr.net/emojione/ for its emoji script and images
 * A nonce-based policy for the dynamic admin area is evaluated in Stage 4 (risk R-002).
 */
const TAWK = "https://*.tawk.to";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com ${TAWK} https://cdn.jsdelivr.net/emojione/${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline' ${TAWK}`,
  `img-src 'self' blob: data: https://i.ytimg.com ${TAWK} https://cdn.jsdelivr.net/emojione/${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
  `font-src 'self' ${TAWK}`,
  `media-src 'self' ${TAWK}`,
  `connect-src 'self' ${TAWK} wss://*.tawk.to${supabaseOrigin ? ` ${supabaseOrigin} ${supabaseWs}` : ""}`,
  `frame-src https://www.youtube-nocookie.com https://challenges.cloudflare.com https://www.google.com ${TAWK}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // `preload` is deliberately omitted until the production domain is confirmed (Stage 12).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    // Property photos are served from the public Supabase Storage bucket.
    remotePatterns: supabaseOrigin
      ? [{ protocol: "https", hostname: new URL(supabaseOrigin).hostname, pathname: "/storage/v1/object/public/**" }]
      : [],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    // Photos are resized in the browser before upload (max 2400 px WebP, well under this).
    // Kept below Vercel's 4.5 MB request limit.
    serverActions: { bodySizeLimit: "4mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The FAQ is a section of the About page (owner brief); the old address keeps working.
  async redirects() {
    return [{ source: "/faq", destination: "/about#faq", permanent: true }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/admin",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
