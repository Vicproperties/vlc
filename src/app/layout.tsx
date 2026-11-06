import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk } from "next/font/google";
import { siteConfig } from "@/config/site";
import { getBranding } from "@/features/content/queries";
import { publicEnv } from "@/lib/env/client";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// Self-hosted by next/font at build time: no runtime requests to Google.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

/** Browser-tab icon: the one uploaded in Website Settings, otherwise the default. */
export async function generateMetadata(): Promise<Metadata> {
  const { faviconUrl } = await getBranding();
  return {
    metadataBase: new URL(publicEnv().NEXT_PUBLIC_SITE_URL),
    title: {
      default: siteConfig.name,
      template: `%s | ${siteConfig.name}`,
    },
    icons: faviconUrl
      ? { icon: [{ url: faviconUrl, type: "image/png" }], apple: [{ url: faviconUrl }] }
      : { icon: [{ url: "/favicon.ico" }] },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={hanken.variable}>
      <body className="flex min-h-dvh flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
