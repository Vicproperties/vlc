import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Handshake,
  HeartHandshake,
  Mail,
  MessageCircle,
  Phone,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
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

/** Icons for "Why choose us" cards, in order (the items themselves are text only). */
const WHY_ICONS = [ShieldCheck, BadgeCheck, TrendingUp, HeartHandshake, Handshake, Building2];

function Heading({ id, title, text, eyebrow }: { id: string; title: string; text?: string; eyebrow?: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {eyebrow && <p className="text-caption font-semibold tracking-[0.12em] text-brand uppercase">{eyebrow}</p>}
      <h2 id={id} className="text-h2">
        {title}
      </h2>
      {text && <p className="text-body text-stone">{text}</p>}
    </div>
  );
}

/** "Property categories": type + purpose groups that currently have listings, as a strip under the hero. */
export async function PropertyCategories() {
  const categories = await getListingCategories();
  if (!categories.length) return null;
  return (
    <section className="relative z-10 container-content -mt-12" aria-labelledby="categories-heading">
      <div className="flex flex-col gap-4 rounded-2xl border border-line/70 bg-white p-5 shadow-card md:flex-row md:items-center md:gap-6 md:px-7">
        <h2 id="categories-heading" className="shrink-0 text-small font-semibold text-ink">
          Browse by category
        </h2>
        <ul className="flex flex-wrap gap-2.5">
          {categories.map((c) => (
            <li key={`${c.kind}-${c.purpose}`}>
              <Link
                href={`/properties?kind=${c.kind}&purpose=${c.purpose}`}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-small font-medium text-ink transition-colors hover:border-brand hover:bg-brand-tint hover:text-brand"
              >
                {TYPE_LABEL[c.kind]} {PURPOSE_LABEL[c.purpose]}
                <span className="rounded-full bg-white px-2 py-0.5 text-caption text-stone">
                  {c.count}
                  <span className="sr-only">{c.count === 1 ? " listing" : " listings"}</span>
                </span>
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
    <section className="container-content pt-16 md:pt-20" aria-labelledby="about-preview-heading">
      <div className="grid gap-8 rounded-3xl bg-surface p-8 md:grid-cols-[1fr_1.4fr] md:gap-16 md:p-12">
        <Heading id="about-preview-heading" eyebrow="About us" title={intro.heading ?? "Who we are"} />
        <div className="flex flex-col gap-6">
          <p className="text-body-lg whitespace-pre-line text-ink">{preview}</p>
          <ButtonLink
            href="/about"
            variant="secondary"
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
    <section className="container-content py-16 md:py-20" aria-labelledby="why-heading">
      <div className="grid gap-10 rounded-3xl bg-brand-tint/60 p-8 md:p-12 lg:grid-cols-[0.8fr_2fr] lg:items-center">
        <Heading
          id="why-heading"
          eyebrow="Why choose us"
          title={heading ?? "Built on trust, driven by service"}
          text={text}
        />
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item, index) => {
            const Icon = WHY_ICONS[index % WHY_ICONS.length];
            return (
              <li
                key={item.id}
                className="flex flex-col items-center gap-3 rounded-2xl bg-white p-6 text-center shadow-card"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-brand text-white">
                  <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="text-body font-bold text-ink">{item.title}</h3>
                {item.description && <p className="text-small text-stone">{item.description}</p>}
              </li>
            );
          })}
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
    <section className="container-content flex flex-col gap-10 pb-16 md:pb-20" aria-labelledby="news-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Heading id="news-heading" eyebrow="Blog" title="Latest property news" />
        <ButtonLink
          href="/blog"
          variant="secondary"
          trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
        >
          All articles
        </ButtonLink>
      </div>
      <ArticleGrid articles={articles} />
    </section>
  );
}

/** "Contact section": call-to-action band with the configured contact details. */
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
    <section className="container-content pb-16 md:pb-20" aria-labelledby="contact-heading">
      <div className="flex flex-col gap-8 rounded-3xl bg-brand px-8 py-10 text-white md:flex-row md:items-center md:justify-between md:px-12 md:py-12">
        <div className="flex max-w-2xl flex-col gap-3">
          <h2 id="contact-heading" className="text-h2 text-white">
            Ready to find your next property?
          </h2>
          <p className="text-body text-white/85">
            Ask about a listing, book an inspection or tell us what you are looking for.
          </p>
          {items.length > 0 && (
            <ul className="flex flex-wrap gap-x-6 gap-y-2 pt-2">
              {items.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className="inline-flex items-center gap-2 text-small font-medium text-white underline-offset-4 hover:underline"
                  >
                    <item.icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
                    {item.label}
                    {item.external && <span className="sr-only">(opens in a new tab)</span>}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Link
          href="/contact"
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-white px-6 text-small font-semibold text-brand transition-colors hover:bg-brand-tint md:self-center"
        >
          Get in touch
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
