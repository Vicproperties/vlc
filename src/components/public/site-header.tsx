import Link from "next/link";
import { siteConfig, publicNav } from "@/config/site";
import { DesktopNav, MobileNav } from "./site-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/95 backdrop-blur-sm supports-[backdrop-filter]:bg-paper/85">
      <div className="container-content flex h-18 items-center justify-between gap-8">
        <Link href="/" className="font-serif text-[1.375rem] leading-none tracking-[-0.01em] text-ink">
          {siteConfig.name}
        </Link>
        <DesktopNav items={publicNav} />
        <MobileNav items={publicNav} />
      </div>
    </header>
  );
}
