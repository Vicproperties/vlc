import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/components/public/contact-form";
import { PageHero } from "@/components/public/page-hero";
import { SocialLinks } from "@/components/public/social-icons";
import { siteConfig } from "@/config/site";
import { getContactDetails, getPageSections } from "@/features/content/queries";
import { findSection, readContent } from "@/features/content/sections";
import { SOCIAL_NETWORKS } from "@/features/settings/networks";
import { parsePhone } from "@/lib/phone";

export const metadata: Metadata = {
  title: "Contact",
  description: "Send us a message about buying, renting or leasing land and buildings.",
  alternates: { canonical: "/contact" },
};

/**
 * Contact page. Details come from Website Settings and appear only when entered; the
 * introduction comes from the Contact page section. Nothing is invented.
 */
export default async function ContactPage() {
  const [details, sections] = await Promise.all([getContactDetails(), getPageSections("contact")]);
  const intro = readContent(findSection("contact", "intro")!, sections.intro);
  const phones = [details.phonePrimary, details.phoneSecondary]
    .map((value) => (value ? parsePhone(value) : null))
    .filter((value): value is Extract<ReturnType<typeof parsePhone>, { ok: true }> => Boolean(value?.ok));
  const whatsapp = details.whatsapp?.replace(/\D/g, "");
  const social = SOCIAL_NETWORKS.filter((n) => details.social[n.key]);

  const items: Array<{ icon: typeof Phone; label: string; href: string; external?: boolean }> = [
    ...phones.map((p) => ({ icon: Phone, label: p.international, href: `tel:${p.e164}` })),
    ...(details.email ? [{ icon: Mail, label: details.email, href: `mailto:${details.email}` }] : []),
    ...(whatsapp
      ? [{ icon: MessageCircle, label: "Chat on WhatsApp", href: `https://wa.me/${whatsapp}`, external: true }]
      : []),
  ];

  const iconBox = "flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand";
  const hasDetails = items.length > 0 || details.address || details.hours.length > 0 || social.length > 0;

  return (
    <div className="flex flex-col">
      <PageHero
        eyebrow="Contact"
        title={intro.heading ?? "Contact us"}
        text={
          <p className="whitespace-pre-line">
            {intro.text ??
              "Send a message about a property, an inspection or anything else, and we will get back to you."}
          </p>
        }
      />
      <div className="container-content flex flex-col gap-14 py-16 md:py-24">
        <div
          className={
            hasDetails ? "grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14" : "mx-auto grid w-full max-w-2xl gap-10"
          }
        >
          {hasDetails && (
            <div className="flex flex-col gap-4" data-reveal-stagger>
              <h2 className="text-h3">Get in touch</h2>
              {items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex items-center gap-4 rounded-2xl border border-line bg-white p-4 transition-[border-color,box-shadow] duration-200 hover:border-brand-light hover:shadow-card"
                >
                  <span aria-hidden="true" className={iconBox}>
                    <item.icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 text-body font-semibold break-words text-ink">{item.label}</span>
                  {item.external && <span className="sr-only">(opens in a new tab)</span>}
                </a>
              ))}
              {details.address && (
                <div className="flex items-start gap-4 rounded-2xl border border-line bg-white p-4">
                  <span aria-hidden="true" className={iconBox}>
                    <MapPin className="size-5" strokeWidth={1.75} />
                  </span>
                  <p className="pt-2 text-body whitespace-pre-line text-ink">
                    <span className="sr-only">Address: </span>
                    {details.address}
                  </p>
                </div>
              )}
              {details.hours.length > 0 && (
                <div className="flex items-start gap-4 rounded-2xl border border-line bg-white p-4">
                  <span aria-hidden="true" className={iconBox}>
                    <Clock className="size-5" strokeWidth={1.75} />
                  </span>
                  <div className="pt-2">
                    <h2 className="sr-only">Opening hours</h2>
                    <ul className="flex flex-col gap-1 text-body text-ink">
                      {details.hours.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {social.length > 0 && (
                <SocialLinks
                  className="pt-2"
                  links={social.map((network) => [network.key, details.social[network.key]])}
                  who={siteConfig.name}
                />
              )}
            </div>
          )}
          <div className="relative" data-reveal>
            <span
              aria-hidden="true"
              className="absolute -top-3 -right-3 -z-10 hidden h-1/2 w-1/2 rounded-[2rem] bg-brand-light sm:block"
            />
            <div className="rounded-[2rem] rounded-tl-md border border-line/70 bg-white p-6 shadow-overlay sm:p-10">
              <h2 className="mb-6 text-h3">Send us a message</h2>
              <ContactForm />
            </div>
          </div>
        </div>

        {details.mapEmbedUrl && (
          <iframe
            src={details.mapEmbedUrl}
            title="Map showing our office"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="aspect-[4/3] w-full rounded-[2rem] border border-line sm:aspect-[16/7]"
          />
        )}
      </div>
    </div>
  );
}
