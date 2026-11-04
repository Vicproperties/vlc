import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, Newsreader } from "next/font/google";
import { siteConfig } from "@/config/site";
import { publicEnv } from "@/lib/env/client";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// Self-hosted by next/font at build time: no runtime requests to Google.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv().NEXT_PUBLIC_SITE_URL),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={`${newsreader.variable} ${hanken.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
