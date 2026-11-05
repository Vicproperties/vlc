import Link from "next/link";
import { ArrowRight, Mail, MessageCircle, Phone } from "lucide-react";
import { ArticleGrid } from "@/components/public/article-card";
import { ButtonLink } from "@/components/ui/button";
import { getLatestArticles } from "@/features/blog/queries";
import { getContactDetails, getPageSections } from "@/features/content/queries";
import { findSection, readContent } from "@/features/content/sections";
import { getListingCategories, getWhyChooseUsItems } from "@/features/listings/queries";
import { richTextToPlain, sanitizeRichText } from "@/lib/rich-text";
import { parsePhone } from "@/lib/phone";

/**
 * Homepage (and About page) sections required by the owner's brief. Every section shows only
 * real content: a section with nothing to show is left out entirely.
 */
const TYPE_LABEL = { land: "Land", building: "Buildings" } as const;
const PURPOSE_LABEL = { sale: "for sale", rent: "for rent", lease: "for lease" } as const;

function Heading({ id, title, text, eyebrow }: { id: string; title: string; text?: string; eyebrow?: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={id} className="text-h1">
        {title}
      </h2>
      {text && <p className="text-body text-stone">{text}</p>}
    </div>
  );
}

/** "Property categories": type + purpose groups that currently have listings. */
export async function PropertyCategories() {
  const categories = await getListingCategories();
  if (!categories.length) return null;
  return (
    <section className="border-b border-line" aria-labelledby="categories-heading">
      <div className="container-content flex flex-col gap-8 py-14 md:py-16">
        <h2 id="categories-heading" className="text-h3">
          Browse by category
        </h2>
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <li key={`${c.kind}-${c.purpose}`} className="bg-paper">
              <Link
                href={`/properties?kind=${c.kind}&purpose=${c.purpose}`}
                className="group flex items-center justify-between gap-4 p-6 transition-colors hover:bg-brand-tint"
              >
                <span className="flex flex-col gap-1">
                  <span className="font-serif text-h4 text-ink">
                    {TYPE_LABEL[c.kind]} {PURPOSE_LABEL[c.purpose]}
                  </span>
                  <span className="text-small text-stone">
                    {c.count} {c.count === 1 ? "listing" : "listings"}
                  </span>
                </span>
                <ArrowRight
                  className="size-4 text-brand transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** "About company preview": the opening of the About text, with a link to the full page. */
export async function AboutPreview() {
  const sections = await getPageSections("about");
  const def = findSection("about", "intro");
  if (!def) return null;
  const intro = readContent(def, sections.intro);
  const plain = intro.body ? richTextToPlain(sanitizeRichText(intro.body)) : "";
  if (!plain) return null;
  const firstParagraph = plain.split(/\n\s*\n/)[0];
  const preview =
    firstParagraph.length > 420 ? `${firstParagraph.slice(0, 400).replace(/\s+\S*$/, "")}…` : firstParagraph;
  return (
    <section className="border-t border-line bg-surface" aria-labelledby="about-preview-heading">
      <div className="container-content grid gap-8 py-16 md:grid-cols-[1fr_1.4fr] md:gap-16 md:py-24">
        <Heading id="about-preview-heading" eyebrow="About us" title={intro.heading ?? "Who we are"} />
        <div className="flex flex-col gap-6">
          <p className="text-h4 font-normal whitespace-pre-line text-ink">{preview}</p>
          <ButtonLink
            href="/about"
            variant="link"
            className="self-start"
            trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
          >
            More about us
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/** "Why choose us" (homepage and About page). */
export async function WhyChooseUs({ heading, text }: { heading?: string; text?: string }) {
  const items = await getWhyChooseUsItems();
  if (!items.length) return null;
  return (
    <section className="border-t border-line bg-surface" aria-labelledby="why-heading">
      <div className="container-content flex flex-col gap-12 py-16 md:py-24">
        <Heading id="why-heading" title={heading ?? "Why choose us"} text={text} />
        <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 border-t border-brand-light pt-6">
              <h3 className="font-serif text-h4 text-ink">{item.title}</h3>
              {item.description && <p className="text-small text-stone">{item.description}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** "Latest Property News": newest published articles. */
export async function LatestNews() {
  const articles = await getLatestArticles(3);
  if (!articles.length) return null;
  return (
    <section className="container-content flex flex-col gap-10 py-16 md:py-24" aria-labelledby="news-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Heading id="news-heading" title="Latest property news" />
        <ButtonLink href="/blog" variant="link" trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}>
          All articles
        </ButtonLink>
      </div>
      <ArticleGrid articles={articles} />
    </section>
  );
}

/** "Contact section": configured contact details plus a link to the contact page. */
export async function ContactSection() {
  const details = await getContactDetails();
  const phone = details.phonePrimary ? parsePhone(details.phonePrimary) : null;
  const whatsapp = details.whatsapp?.replace(/\D/g, "");
  const items = [
    phone?.ok ? { icon: Phone, label: phone.international, href: `tel:${phone.e164}` } : null,
    details.email ? { icon: Mail, label: details.email, href: `mailto:${details.email}` } : null,
    whatsapp
      ? { icon: MessageCircle, label: "Chat on WhatsApp", href: `https://wa.me/${whatsapp}`, external: true }
      : null,
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; href: string; external?: boolean }>;

  return (
    <section className="border-t border-line" aria-labelledby="contact-heading">
      <div className="container-content flex flex-col gap-8 py-16 md:flex-row md:items-end md:justify-between md:py-20">
        <Heading
          id="contact-heading"
          title="Let’s talk about your next property"
          text="Ask about a listing, book an inspection or tell us what you are looking for."
        />
        <div className="flex flex-col gap-5 md:items-end">
          {items.length > 0 && (
            <ul className="flex flex-col gap-3 md:items-end">
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
          <ButtonLink href="/contact">Contact us</ButtonLink>
        </div>
      </div>
    </section>
  );
}
