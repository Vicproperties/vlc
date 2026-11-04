import type { Metadata } from "next";

// The entire admin area must never be indexed. An X-Robots-Tag header is also sent (next.config.ts).
export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s | Dashboard" },
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col bg-paper text-small">{children}</div>;
}
