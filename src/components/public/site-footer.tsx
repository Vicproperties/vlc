import Link from "next/link";
import { cacheLife } from "next/cache";
import { legalNav, publicNav, siteConfig } from "@/config/site";
import { getContactDetails } from "@/features/content/queries";
import { SOCIAL_NETWORKS } from "@/features/settings/networks";
import { parsePhone } from "@/lib/phone";

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return <>{new Date().getFullYear()}</>;
}

const linkClass = "text-small text-white/90 transition-colors hover:text-white";
const headingClass = "mb-4 text-caption font-medium tracking-[0.14em] text-white/75 uppercase";

/** Footer. Contact details and social links come from Website Settings; empty ones are hidden. */
export async function SiteFooter() {
  const details = await getContactDetails();
  const phone = details.phonePrimary ? parsePhone(details.phonePrimary) : null;
  const whatsapp = details.whatsapp?.replace(/\D/g, "");
  const social = SOCIAL_NETWORKS.filter((n) => details.social[n.key]);
  const explore = [...publicNav, { label: "FAQ", href: "/faq" }];
  const hasContact = Boolean((phone && phone.ok) || details.email || whatsapp || details.address);

  return (
    <footer className="mt-auto bg-brand-deep text-white">
      <div className="container-content grid gap-12 py-16 md:grid-cols-[2fr_1fr_1fr_1fr] md:py-20">
        <div className="flex flex-col gap-4">
          <p className="font-serif text-h3">{siteConfig.name}</p>
          {details.tagline && <p className="max-w-sm text-small text-white/80">{details.tagline}</p>}
          {social.length > 0 && (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-2" aria-label="Social media">
              {social.map((network) => (
                <li key={network.key}>
                  <a href={details.social[network.key]} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {network.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <nav aria-label="Footer">
          <p className={headingClass}>Explore</p>
          <ul className="flex flex-col gap-3">
            {explore.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {hasContact ? (
          <div>
            <p className={headingClass}>Contact</p>
            <ul className="flex flex-col gap-3">
              {phone?.ok && (
                <li>
                  <a href={`tel:${phone.e164}`} className={linkClass}>
                    {phone.international}
                  </a>
                </li>
              )}
              {details.email && (
                <li>
                  <a href={`mailto:${details.email}`} className={`${linkClass} break-all`}>
                    {details.email}
                  </a>
                </li>
              )}
              {whatsapp && (
                <li>
                  <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    WhatsApp
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              )}
              {details.address && <li className="text-small whitespace-pre-line text-white/80">{details.address}</li>}
            </ul>
          </div>
        ) : (
          <div />
        )}
        <nav aria-label="Legal">
          <p className={headingClass}>Legal</p>
          <ul className="flex flex-col gap-3">
            {legalNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/15">
        <div className="container-content flex flex-col gap-2 py-6 text-caption text-white/75 sm:flex-row sm:justify-between">
          <p>
            &copy; <CopyrightYear /> {siteConfig.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
