import Link from "next/link";
import { Suspense } from "react";
import { Home, Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig, publicNav } from "@/config/site";
import { getBranding } from "@/features/content/queries";
import { AccountLink } from "./favourite-button";
import { DesktopNav, DesktopNavLinks, MobileNav, MobileNavMenu } from "./site-nav";

/** Logo uploaded in Website Settings, otherwise a simple mark with the company name. */
export async function SiteLogo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const { logoUrl } = await getBranding();
  if (logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- uploaded logo of unknown aspect ratio
    const img = <img src={logoUrl} alt={siteConfig.name} className="h-10 w-auto max-w-[12rem] object-contain" />;
    // On dark backgrounds the logo sits on a white panel, so dark logos stay visible.
    return variant === "light" ? <span className="inline-flex rounded-xl bg-white px-3 py-2">{img}</span> : img;
  }
  return (
    <span className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={
          variant === "dark"
            ? "flex size-9 items-center justify-center rounded-xl bg-brand text-white"
            : "flex size-9 items-center justify-center rounded-xl bg-white text-brand"
        }
      >
        <Home className="size-5" strokeWidth={2} />
      </span>
      <span
        className={
          variant === "dark"
            ? "text-body font-bold tracking-[-0.02em] text-ink"
            : "text-body font-bold tracking-[-0.02em] text-white"
        }
      >
        {siteConfig.name}
      </span>
    </span>
  );
}

/** Floating rounded header (sticky). */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 px-3 pt-3 md:px-6">
      <div className="mx-auto flex h-16 max-w-(--container-content) items-center justify-between gap-6 rounded-2xl border border-line/70 bg-white/95 px-4 shadow-card backdrop-blur-sm md:h-[4.25rem] md:px-6">
        <Link href="/" aria-label={`${siteConfig.name}, home`} className="shrink-0">
          <Suspense fallback={<span className="text-body font-bold text-ink">{siteConfig.name}</span>}>
            <SiteLogo />
          </Suspense>
        </Link>
        <Suspense fallback={<DesktopNavLinks items={publicNav} pathname="" />}>
          <DesktopNav items={publicNav} />
        </Suspense>
        <div className="flex items-center gap-3 md:gap-4">
          <AccountLink className="hidden text-small font-semibold text-ink transition-colors hover:text-brand sm:inline" />
          <div className="hidden md:block">
            <ButtonLink
              href="/properties"
              size="sm"
              className="h-10"
              leadingIcon={<Search className="size-4" aria-hidden="true" />}
            >
              Find property
            </ButtonLink>
          </div>
          <Suspense fallback={<MobileNavMenu items={publicNav} pathname="" />}>
            <MobileNav items={publicNav} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
