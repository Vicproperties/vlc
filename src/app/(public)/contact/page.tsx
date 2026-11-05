import type { Metadata } from "next";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/components/public/contact-form";
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

  return (
    <div className="container-content flex flex-col gap-14 py-12 md:py-20">
      <div className="grid gap-14 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <div className="flex flex-col gap-6">
          <h1 className="text-h1">{intro.heading ?? "Contact us"}</h1>
          <p className="max-w-md text-body whitespace-pre-line text-stone">
            {intro.text ??
              "Send a message about a property, an inspection or anything else, and we will get back to you."}
          </p>
          {items.length > 0 && (
            <ul className="flex flex-col gap-4 border-t border-line pt-6">
              {items.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="inline-flex items-center gap-3 text-body text-ink underline-offset-4 hover:underline"
                  >
                    <item.icon className="size-4 text-brand" strokeWidth={1.5} aria-hidden="true" />
                    {item.label}
                    {item.external && <span className="sr-only">(opens in a new tab)</span>}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {details.address && (
            <p className="flex gap-3 text-body whitespace-pre-line text-ink">
              <MapPin className="mt-1 size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden="true" />
              {details.address}
            </p>
          )}
          {details.hours.length > 0 && (
            <div className="flex gap-3">
              <Clock className="mt-1 size-4 shrink-0 text-brand" strokeWidth={1.5} aria-hidden="true" />
              <div>
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
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {social.map((network) => (
                <li key={network.key}>
                  <a
                    href={details.social[network.key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-small text-brand underline underline-offset-4"
                  >
                    {network.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border border-line p-6 sm:p-8">
          <ContactForm />
        </div>
      </div>

      {details.mapEmbedUrl && (
        <iframe
          src={details.mapEmbedUrl}
          title="Map showing our office"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="aspect-[16/7] w-full border border-line"
        />
      )}
    </div>
  );
}
