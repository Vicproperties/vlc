import { Suspense } from "react";
import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { AnnouncementPopup, TopBannerBar } from "@/components/public/marketing";
import { CookieConsent } from "@/components/public/cookie-consent";
import { getCookieSettings } from "@/features/cookies/queries";
import { getActiveAnnouncement, getActiveBanner } from "@/features/marketing/queries";
import { JsonLd } from "@/components/public/json-ld";
import { siteConfig } from "@/config/site";
import { publicEnv } from "@/lib/env/client";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  // Only confirmed facts: the company name and website. Contact details join in Stage 8.
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: publicEnv().NEXT_PUBLIC_SITE_URL,
  };
  const [banner, announcement, cookieSettings] = await Promise.all([
    getActiveBanner(),
    getActiveAnnouncement(),
    getCookieSettings(),
  ]);
  return (
    <>
      <JsonLd data={organization} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      {banner && <TopBannerBar key={banner.id} banner={banner} />}
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      {announcement && (
        <AnnouncementPopup key={`${announcement.id}:${announcement.version}`} announcement={announcement} />
      )}
      {/* Reads the page address (for statistics): must sit inside Suspense so pages can prerender. */}
      <Suspense fallback={null}>
        <CookieConsent
          notice={cookieSettings.notice}
          analyticsDescription={cookieSettings.analyticsDescription}
          policyVersion={cookieSettings.policyVersion}
          analyticsEnabled={cookieSettings.analyticsEnabled}
        />
      </Suspense>
    </>
  );
}
