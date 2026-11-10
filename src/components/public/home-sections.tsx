import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
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
import { Eyebrow, Rings, SectionHeading } from "@/components/public/page-hero";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { getLatestArticles } from "@/features/blog/queries";
import { getContactDetails, getPageSections } from "@/features/content/queries";
import { findSection, readContent } from "@/features/content/sections";
import { getListingCategories, getWhyChooseUsItems } from "@/features/listings/queries";
import { publicStorageUrl } from "@/lib/images";
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

/** "Property categories": type + purpose groups that currently have listings, as a strip under the hero. */
export async function PropertyCategories() {
  const categories = await getListingCategories();
  if (!categories.length) return null;
  return (
    <section className="relative z-10 container-content -mt-10 md:-mt-12" aria-labelledby="categories-heading">
      <div
        data-reveal
        className="flex flex-col gap-4 rounded-[1.75rem] border border-line/70 bg-white p-5 shadow-overlay md:flex-row md:items-center md:gap-8 md:px-8 md:py-6"
      >
        <h2 id="categories-heading" className="flex shrink-0 items-center gap-3 text-small font-bold text-ink">
          <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-xl bg-brand text-white">
            <Building2 className="size-4" strokeWidth={2} />
          </span>
          Browse by category
        </h2>
        <ul className="flex flex-wrap gap-2.5">
          {categories.map((c) => (
            <li key={`${c.kind}-${c.purpose}`}>
              <Link
                href={`/properties?kind=${c.kind}&purpose=${c.purpose}`}
                className="group inline-flex items-center gap-2 rounded-full bg-brand-tint py-2 pr-2 pl-4 text-small font-semibold text-brand transition-colors duration-200 hover:bg-brand hover:text-white"
              >
                {TYPE_LABEL[c.kind]} {PURPOSE_LABEL[c.purpose]}
                <span className="rounded-full bg-white px-2.5 py-0.5 text-caption font-semibold text-brand">
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

/** Brand monogram panel, used where the owner has not uploaded a photo yet. */
export function Monogram({ className }: { className?: string }) {
  return (
    <div
      className={`relative isolate flex flex-col items-center justify-center overflow-hidden rounded-[2rem] bg-brand-tint ${className ?? ""}`}
    >
      <Rings className="top-1/2 left-1/2 -z-10 size-[130%] -translate-x-1/2 -translate-y-1/2 text-brand/10" />
      <span
        aria-hidden="true"
        className="text-[clamp(4rem,12vw,7.5rem)] leading-none font-bold tracking-[-0.04em] text-brand"
      >
        V.I.C
      </span>
      <span aria-hidden="true" className="mt-3 text-caption font-semibold tracking-[0.3em] text-brand-mid uppercase">
        Land and Property
      </span>
    </div>
  );
}

/** "About company preview": the opening of the About text and photo, with a link to the full page. */
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
  const image = intro.image_path ? publicStorageUrl("site-media", intro.image_path) : null;

  return (
    <section className="container-content pt-24 md:pt-32" aria-labelledby="about-preview-heading">
      <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <span
            aria-hidden="true"
            className="absolute -right-4 -bottom-4 -z-10 h-2/3 w-2/3 rounded-[2rem] bg-brand-light md:-right-6 md:-bottom-6"
          />
          {image ? (
            <div data-reveal="image" className="relative aspect-[5/4] overflow-hidden rounded-[2rem] lg:aspect-[4/5]">
              <Image src={image} alt="" fill sizes="(min-width: 1024px) 40vw, 90vw" className="object-cover" />
            </div>
          ) : (
            <Monogram className="aspect-[5/4] lg:aspect-[4/5]" />
          )}
          <div
            data-reveal
            className="absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-overlay sm:left-8"
          >
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-xl bg-brand text-white"
            >
              <Building2 className="size-5" strokeWidth={1.75} />
            </span>
            <span className="flex flex-col">
              <span className="text-small font-bold text-ink">{siteConfig.name}</span>
              <span className="text-caption text-stone">Land and buildings · sale, rent, lease</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-7 pt-6 lg:pt-0">
          <SectionHeading id="about-preview-heading" eyebrow="About us" title={intro.heading ?? "Who we are"} />
          <p data-reveal className="text-body-lg whitespace-pre-line text-stone">
            {preview}
          </p>
          <div data-reveal>
            <ButtonLink href="/about" trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}>
              More about us
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/** "Why choose us" (homepage and About page): white cards with one squared corner on a purple band. */
export async function WhyChooseUs({ heading, text }: { heading?: string; text?: string }) {
  const items = await getWhyChooseUsItems();
  if (!items.length) return null;
  return (
    <section className="container-content py-20 md:py-28" aria-labelledby="why-heading">
      <div className="relative isolate overflow-hidden rounded-[2.5rem] bg-brand px-5 py-14 sm:px-10 md:px-14 md:py-20">
        <Rings className="-top-52 -left-52 -z-10 size-[40rem] text-brand-light/10" />
        <Rings className="-right-40 -bottom-60 -z-10 size-[32rem] text-brand-light/10" />
        <div className="grid gap-12 lg:grid-cols-[0.85fr_2fr] lg:gap-16">
          <div className="flex flex-col gap-8">
            <SectionHeading
              id="why-heading"
              eyebrow="Why choose us"
              title={heading ?? "Built on trust, driven by service"}
              text={text}
              tone="dark"
            />
            <div data-reveal>
              <ButtonLink
                href="/contact"
                variant="inverse"
                trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
              >
                Talk to us
              </ButtonLink>
            </div>
          </div>
          <ul data-reveal-stagger className="grid gap-5 sm:grid-cols-2">
            {items.map((item, index) => {
              const Icon = WHY_ICONS[index % WHY_ICONS.length];
              return (
                <li
                  key={item.id}
                  className="group relative flex flex-col gap-4 overflow-hidden rounded-[1.75rem] rounded-tl-md bg-white p-7 transition-[box-shadow,background-color] duration-300 hover:bg-brand-tint hover:shadow-card-hover sm:even:mt-10"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span
                      aria-hidden="true"
                      className="flex size-14 items-center justify-center rounded-2xl rounded-tl-sm bg-brand-light text-brand transition-colors duration-300 group-hover:bg-brand group-hover:text-white"
                    >
                      <Icon className="size-6" strokeWidth={1.75} />
                    </span>
                    <span aria-hidden="true" className="text-h3 font-bold tracking-[-0.04em] text-brand-light">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-h4 font-bold text-ink">{item.title}</h3>
                  {item.description && <p className="text-small text-stone">{item.description}</p>}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-7 bottom-0 h-1 origin-left scale-x-0 rounded-t-full bg-brand transition-transform duration-300 group-hover:scale-x-100"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

/** "Latest Property News": newest published articles. */
export async function LatestNews() {
  const articles = await getLatestArticles(3);
  if (!articles.length) return null;
  return (
    <section className="container-content flex flex-col gap-12 pb-20 md:pb-28" aria-labelledby="news-heading">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <SectionHeading
          id="news-heading"
          eyebrow="Blog"
          title="Latest property news"
          text="Guides, market updates and advice for buyers, tenants and investors."
        />
        <ButtonLink
          href="/blog"
          variant="secondary"
          className="self-start md:self-auto"
          trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
        >
          All articles
        </ButtonLink>
      </div>
      <ArticleGrid articles={articles} />
    </section>
  );
}

/** "Contact section": a Soft Lavender call-to-action with the configured contact details. */
export async function ContactSection() {
  const details = await getContactDetails();
  const phone = details.phonePrimary ? parsePhone(details.phonePrimary) : null;
  const whatsapp = details.whatsapp?.replace(/\D/g, "");
  const items = [
    phone?.ok ? { icon: Phone, title: "Call us", label: phone.international, href: `tel:${phone.e164}` } : null,
    details.email ? { icon: Mail, title: "Email", label: details.email, href: `mailto:${details.email}` } : null,
    whatsapp
      ? {
          icon: MessageCircle,
          title: "WhatsApp",
          label: "Chat on WhatsApp",
          href: `https://wa.me/${whatsapp}`,
          external: true,
        }
      : null,
  ].filter(Boolean) as Array<{ icon: typeof Phone; title: string; label: string; href: string; external?: boolean }>;

  return (
    <section className="container-content pb-24 md:pb-32" aria-labelledby="contact-heading">
      <div
        data-reveal
        className="relative isolate grid gap-10 overflow-hidden rounded-[2.5rem] bg-brand-light px-6 py-14 sm:px-10 md:px-14 md:py-16 lg:grid-cols-[1.2fr_1fr] lg:items-center"
      >
        <Rings className="-top-48 -right-48 -z-10 size-[36rem] text-brand/10" />
        <div className="flex max-w-xl flex-col gap-5">
          <Eyebrow>Get in touch</Eyebrow>
          <h2 id="contact-heading" className="text-h2 text-brand">
            Ready to find your next property?
          </h2>
          <p className="text-body-lg text-brand">
            Ask about a listing, book an inspection or tell us what you are looking for.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href="/contact" trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}>
              Get in touch
            </ButtonLink>
            <ButtonLink href="/properties" variant="secondary">
              View properties
            </ButtonLink>
          </div>
        </div>
        {items.length > 0 && (
          <ul data-reveal-stagger className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex items-center gap-4 rounded-2xl bg-white px-5 py-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white"
                  >
                    <item.icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-caption font-semibold tracking-[0.08em] text-stone uppercase">
                      {item.title}
                    </span>
                    <span className="truncate text-body font-semibold text-ink">{item.label}</span>
                  </span>
                  <ArrowUpRight
                    className="ml-auto size-5 shrink-0 text-brand transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden="true"
                  />
                  {item.external && <span className="sr-only">(opens in a new tab)</span>}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
