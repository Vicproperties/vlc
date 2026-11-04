import { SiteHeader } from "@/components/public/site-header";
import { SiteFooter } from "@/components/public/site-footer";
import { JsonLd } from "@/components/public/json-ld";
import { siteConfig } from "@/config/site";
import { publicEnv } from "@/lib/env/client";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  // Only confirmed facts: the company name and website. Contact details join in Stage 8.
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: publicEnv().NEXT_PUBLIC_SITE_URL,
  };
  return (
    <>
      <JsonLd data={organization} />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      {/* Top announcement banner slot (Stage 11). */}
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
