import type { Metadata } from "next";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { ContactForm } from "@/components/public/contact-form";
import { getPublicSiteSettings } from "@/features/listings/queries";
import { parsePhone } from "@/lib/phone";

export const metadata: Metadata = {
  title: "Contact",
  description: "Send us a message about buying, renting or leasing land and buildings.",
  alternates: { canonical: "/contact" },
};

/**
 * Contact page. Company contact details come from Website Settings (Stage 8) and are shown
 * only when they have been entered: nothing is invented.
 */
export default async function ContactPage() {
  const settings = await getPublicSiteSettings();
  const phone = settings?.phone_primary ? parsePhone(settings.phone_primary) : null;
  const whatsapp = settings?.whatsapp_number ? settings.whatsapp_number.replace(/\D/g, "") : null;

  const details = [
    phone?.ok && { icon: Phone, label: phone.international, href: `tel:${phone.e164}` },
    settings?.email_primary && { icon: Mail, label: settings.email_primary, href: `mailto:${settings.email_primary}` },
    whatsapp && { icon: MessageCircle, label: "Chat on WhatsApp", href: `https://wa.me/${whatsapp}`, external: true },
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; href: string; external?: boolean }>;

  return (
    <div className="container-content grid gap-14 py-12 md:py-20 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
      <div className="flex flex-col gap-6">
        <h1 className="text-h1">Contact us</h1>
        <p className="max-w-md text-body text-stone">
          Send a message about a property, an inspection or anything else, and we will get back to you.
        </p>
        {details.length > 0 && (
          <ul className="flex flex-col gap-4 border-t border-line pt-6">
            {details.map((item) => (
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
      </div>
      <div className="border border-line p-6 sm:p-8">
        <ContactForm />
      </div>
    </div>
  );
}
