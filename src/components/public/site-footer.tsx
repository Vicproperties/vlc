import Link from "next/link";
import { cacheLife } from "next/cache";
import { legalNav, publicNav, siteConfig } from "@/config/site";

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

/**
 * Footer shell. Contact details, social links and newsletter signup are added
 * from dashboard-managed settings in later stages; nothing is hardcoded here.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto bg-ink text-paper">
      <div className="container-content grid gap-12 py-16 md:grid-cols-[2fr_1fr_1fr] md:py-20">
        <div className="flex flex-col gap-4">
          <p className="font-serif text-h3">{siteConfig.name}</p>
        </div>
        <nav aria-label="Footer">
          <p className="mb-4 text-caption font-medium tracking-[0.14em] text-paper/60 uppercase">Explore</p>
          <ul className="flex flex-col gap-3">
            {publicNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-small text-paper/85 transition-colors hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Legal">
          <p className="mb-4 text-caption font-medium tracking-[0.14em] text-paper/60 uppercase">Legal</p>
          <ul className="flex flex-col gap-3">
            {legalNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-small text-paper/85 transition-colors hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-paper/15">
        <div className="container-content flex flex-col gap-2 py-6 text-caption text-paper/60 sm:flex-row sm:justify-between">
          <p>
            &copy; <CopyrightYear /> {siteConfig.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
