import Link from "next/link";
import { Suspense } from "react";
import { siteConfig, publicNav } from "@/config/site";
import { AccountLink } from "./favourite-button";
import { DesktopNav, DesktopNavLinks, MobileNav, MobileNavMenu } from "./site-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm supports-[backdrop-filter]:bg-paper/85">
      <div className="container-content flex h-18 items-center justify-between gap-8">
        <Link href="/" className="font-serif text-[1.375rem] leading-none tracking-[-0.01em] text-ink">
          {siteConfig.name}
        </Link>
        <div className="flex items-center gap-6 md:gap-9">
          <Suspense fallback={<DesktopNavLinks items={publicNav} pathname="" />}>
            <DesktopNav items={publicNav} />
          </Suspense>
          <AccountLink className="text-small tracking-[0.02em] text-brand underline-offset-4 hover:underline" />
          <Suspense fallback={<MobileNavMenu items={publicNav} pathname="" />}>
            <MobileNav items={publicNav} />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
