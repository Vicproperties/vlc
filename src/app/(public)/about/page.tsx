import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import {
  ArrowRight,
  Award,
  ChevronDown,
  Compass,
  Eye,
  Gem,
  HeartHandshake,
  Lightbulb,
  Scale,
  ShieldCheck,
  Target,
} from "lucide-react";
import { ContactSection, Monogram, WhyChooseUs } from "@/components/public/home-sections";
import { JsonLd } from "@/components/public/json-ld";
import { Eyebrow, PageHero, SectionHeading } from "@/components/public/page-hero";
import { CeoSection, TeamGrid } from "@/components/public/team";
import { ButtonLink } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { getCoreValues, getFaqs, getPageSections, getTeamMembers } from "@/features/content/queries";
import { homeSectionHeadingSchema, readSection } from "@/features/content/home-sections";
import { getHomeSections } from "@/features/listings/queries";
import { findSection, readContent } from "@/features/content/sections";
import { publicStorageUrl } from "@/lib/images";
import { sanitizeRichText } from "@/lib/rich-text";

export const metadata: Metadata = {
  title: "About us",
  description: `Who ${siteConfig.name} is, what we stand for and the people behind our land and property services.`,
  alternates: { canonical: "/about" },
};

/** Icons for core values, in order (the values themselves are text only). */
const VALUE_ICONS = [ShieldCheck, Gem, HeartHandshake, Scale, Lightbulb, Award, Compass];
const TEAM_PREVIEW = 4;

/** About page. Every part comes from the dashboard; parts without content are left out. */
export default async function AboutPage() {
  const [sections, values, team, faqs, homeSections] = await Promise.all([
    getPageSections("about"),
    getCoreValues(),
    getTeamMembers(),
    getFaqs(),
    getHomeSections(),
  ]);
  const why = readSection(homeSectionHeadingSchema, homeSections.get("why_choose_us"));
  const read = (key: string) => readContent(findSection("about", key)!, sections[key]);
  const intro = read("intro");
  const mission = read("mission");
  const vision = read("vision");
  const valuesHead = read("values");
  const teamHead = read("team");
  const ceo = read("ceo");
  const body = intro.body ? sanitizeRichText(intro.body) : "";
  const introImage = intro.image_path ? publicStorageUrl("site-media", intro.image_path) : null;
  const ceoPhoto = ceo.image_path ? publicStorageUrl("site-media", ceo.image_path) : null;
  const empty =
    !body &&
    !mission.text &&
    !vision.text &&
    !ceo.name &&
    values.length === 0 &&
    team.length === 0 &&
    faqs.length === 0;

  return (
    <div className="flex flex-col">
      <PageHero
        eyebrow="About us"
        title={intro.heading ?? "About us"}
        text={`Land and buildings for sale, rent and lease, with ${siteConfig.name}.`}
      >
        <div className="flex flex-wrap gap-3 pt-2">
          <ButtonLink
            href="/properties"
            variant="inverse"
            trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
          >
            View properties
          </ButtonLink>
          <ButtonLink href="/team" variant="outline-light">
            Meet the team
          </ButtonLink>
        </div>
      </PageHero>

      {(body || empty) && (
        <section className="container-content py-20 md:py-28" aria-labelledby="story-heading">
          <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
            <div className="flex flex-col gap-6">
              <Eyebrow>Our story</Eyebrow>
              <h2 id="story-heading" className="text-h2" data-reveal>
                Who we are
              </h2>
              {body ? (
                <div
                  data-reveal
                  className="rich-text text-body-lg text-stone [&_strong]:text-ink"
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              ) : (
                <p className="text-body text-stone">More about us will appear here soon.</p>
              )}
            </div>
            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <span
                aria-hidden="true"
                className="absolute -right-4 -bottom-4 -z-10 h-2/3 w-2/3 rounded-[2rem] bg-brand-light md:-right-6 md:-bottom-6"
              />
              {introImage ? (
                <div data-reveal="image" className="relative aspect-[4/5] overflow-hidden rounded-[2rem] rounded-tl-md">
                  <Image src={introImage} alt="" fill sizes="(min-width: 1024px) 36vw, 90vw" className="object-cover" />
                </div>
              ) : (
                <Monogram className="aspect-[4/5] rounded-tl-md" />
              )}
            </div>
          </div>
        </section>
      )}

      {(mission.text || vision.text) && (
        <section className="container-content pb-20 md:pb-28" aria-label="Mission and vision">
          <div data-reveal-stagger className="grid gap-6 md:grid-cols-2">
            {mission.text && (
              <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-[2rem] rounded-tl-md bg-brand p-8 text-white md:p-12">
                <span
                  aria-hidden="true"
                  className="flex size-14 items-center justify-center rounded-2xl bg-white/10 text-brand-light"
                >
                  <Target className="size-6" strokeWidth={1.75} />
                </span>
                <h2 className="text-caption font-semibold tracking-[0.16em] text-brand-light uppercase">Our mission</h2>
                <p className="text-h3 leading-snug font-semibold whitespace-pre-line text-white">{mission.text}</p>
              </div>
            )}
            {vision.text && (
              <div className="relative isolate flex flex-col gap-5 overflow-hidden rounded-[2rem] rounded-br-md bg-brand-light p-8 md:p-12">
                <span
                  aria-hidden="true"
                  className="flex size-14 items-center justify-center rounded-2xl bg-white text-brand"
                >
                  <Eye className="size-6" strokeWidth={1.75} />
                </span>
                <h2 className="text-caption font-semibold tracking-[0.16em] text-brand uppercase">Our vision</h2>
                <p className="text-h3 leading-snug font-semibold whitespace-pre-line text-brand">{vision.text}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {ceo.name && (
        <div className="bg-brand-tint/60">
          <CeoSection
            heading={ceo.heading}
            name={ceo.name}
            designation={ceo.designation}
            bio={ceo.bio}
            photoUrl={ceoPhoto}
          />
        </div>
      )}

      {values.length > 0 && (
        <section className="container-content flex flex-col gap-12 py-20 md:py-28" aria-labelledby="values-heading">
          <SectionHeading
            id="values-heading"
            eyebrow="What we stand for"
            title={valuesHead.heading ?? "Our values"}
            text={valuesHead.text}
          />
          <ul data-reveal-stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value, index) => {
              const Icon = VALUE_ICONS[index % VALUE_ICONS.length];
              return (
                <li
                  key={value.id}
                  className="group flex flex-col gap-4 rounded-[1.75rem] border border-line bg-white p-7 transition-[border-color,box-shadow] duration-300 hover:border-brand-light hover:shadow-card-hover"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-12 items-center justify-center rounded-full bg-brand-tint text-brand transition-colors duration-300 group-hover:bg-brand group-hover:text-white"
                  >
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="text-h4 font-bold text-ink">{value.title}</h3>
                  {value.description && <p className="text-small text-stone">{value.description}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {team.length > 0 && (
        <section className="border-y border-line bg-surface" aria-labelledby="team-heading">
          <div className="container-content flex flex-col gap-12 py-20 md:py-28">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <SectionHeading
                id="team-heading"
                eyebrow="Our people"
                title={teamHead.heading ?? "Our team"}
                text={teamHead.text}
              />
              <ButtonLink
                href="/team"
                variant="secondary"
                className="self-start md:self-auto"
                trailingIcon={<ArrowRight className="size-4" aria-hidden="true" />}
              >
                Meet the full team
              </ButtonLink>
            </div>
            <TeamGrid members={team.slice(0, TEAM_PREVIEW)} />
          </div>
        </section>
      )}

      {/* Why choose us (same reasons as the homepage). */}
      <Suspense fallback={null}>
        <WhyChooseUs heading={why?.heading} text={why?.text} />
      </Suspense>

      {faqs.length > 0 && (
        <section id="faq" className="container-content scroll-mt-28 pb-20 md:pb-28" aria-labelledby="faq-heading">
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: { "@type": "Answer", text: faq.answer },
              })),
            }}
          />
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
            <SectionHeading
              id="faq-heading"
              eyebrow="Questions"
              title="Frequently asked questions"
              text="Can’t find your answer? Get in touch and we’ll help."
            />
            <div data-reveal-stagger className="flex flex-col gap-3">
              {faqs.map((faq) => (
                <details
                  key={faq.id}
                  className="group rounded-2xl border border-line bg-white px-6 transition-colors open:border-brand-light open:bg-brand-tint/50"
                >
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 text-h4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand transition-colors group-open:bg-brand group-open:text-white"
                    >
                      <ChevronDown className="size-4 transition-transform group-open:rotate-180" strokeWidth={2} />
                    </span>
                  </summary>
                  <p className="pb-6 text-body whitespace-pre-line text-stone">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <Suspense fallback={null}>
        <ContactSection />
      </Suspense>
    </div>
  );
}
