import type { Metadata } from "next";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { getCoreValues, getPageSections, getTeamMembers } from "@/features/content/queries";
import { findSection, readContent } from "@/features/content/sections";
import { publicStorageUrl } from "@/lib/images";
import { sanitizeRichText } from "@/lib/rich-text";

export const metadata: Metadata = {
  title: "About us",
  description: "Who we are, what we stand for and the team behind our land and property services.",
  alternates: { canonical: "/about" },
};

const SOCIAL_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  x: "X",
  instagram: "Instagram",
  facebook: "Facebook",
};

/** About page. Every part comes from the dashboard; parts without content are left out. */
export default async function AboutPage() {
  const [sections, values, team] = await Promise.all([getPageSections("about"), getCoreValues(), getTeamMembers()]);
  const read = (key: string) => readContent(findSection("about", key)!, sections[key]);
  const intro = read("intro");
  const mission = read("mission");
  const vision = read("vision");
  const valuesHead = read("values");
  const teamHead = read("team");
  const body = intro.body ? sanitizeRichText(intro.body) : "";
  const empty = !body && !mission.text && !vision.text && values.length === 0 && team.length === 0;

  return (
    <div className="flex flex-col">
      <section className="container-content flex flex-col gap-8 py-12 md:py-20">
        <h1 className="text-h1">{intro.heading ?? "About us"}</h1>
        {body && <div className="rich-text max-w-3xl text-body text-ink" dangerouslySetInnerHTML={{ __html: body }} />}
        {empty && <p className="text-body text-stone">More about us will appear here soon.</p>}
      </section>

      {(mission.text || vision.text) && (
        <section className="border-y border-line bg-surface" aria-label="Mission and vision">
          <div className="container-content grid gap-12 py-14 md:grid-cols-2 md:py-20">
            {mission.text && (
              <div className="flex flex-col gap-4">
                <h2 className="eyebrow">Our mission</h2>
                <p className="font-serif text-h3 leading-snug whitespace-pre-line text-ink">{mission.text}</p>
              </div>
            )}
            {vision.text && (
              <div className="flex flex-col gap-4">
                <h2 className="eyebrow">Our vision</h2>
                <p className="font-serif text-h3 leading-snug whitespace-pre-line text-ink">{vision.text}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {values.length > 0 && (
        <section className="container-content flex flex-col gap-10 py-14 md:py-20" aria-labelledby="values-heading">
          <div className="flex max-w-2xl flex-col gap-3">
            <h2 id="values-heading" className="text-h1">
              {valuesHead.heading ?? "Our values"}
            </h2>
            {valuesHead.text && <p className="text-body text-stone">{valuesHead.text}</p>}
          </div>
          <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {values.map((value) => (
              <li key={value.id} className="flex flex-col gap-3 border-t border-brand-light pt-6">
                <h3 className="font-serif text-h4 text-ink">{value.title}</h3>
                {value.description && <p className="text-small text-stone">{value.description}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {team.length > 0 && (
        <section className="border-t border-line bg-surface" aria-labelledby="team-heading">
          <div className="container-content flex flex-col gap-10 py-14 md:py-20">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2 id="team-heading" className="text-h1">
                {teamHead.heading ?? "Our team"}
              </h2>
              {teamHead.text && <p className="text-body text-stone">{teamHead.text}</p>}
            </div>
            <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {team.map((member) => {
                const social = Object.entries((member.social_links ?? {}) as Record<string, string>).filter(
                  ([key, url]) => key in SOCIAL_LABELS && /^https:\/\//.test(url),
                );
                return (
                  <li key={member.id} className="flex flex-col gap-4">
                    <div className="relative aspect-[4/5] overflow-hidden bg-paper">
                      {member.photo_path ? (
                        <Image
                          src={publicStorageUrl("site-media", member.photo_path)}
                          alt={`Photo of ${member.name}`}
                          fill
                          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-stone">
                          <UserRound className="size-10" strokeWidth={1} aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-serif text-h4 text-ink">{member.name}</h3>
                      {(member.position || member.department) && (
                        <p className="text-small text-stone">
                          {[member.position, member.department].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    {member.bio && <p className="text-small whitespace-pre-line text-ink">{member.bio}</p>}
                    {social.length > 0 && (
                      <ul className="flex flex-wrap gap-x-4 gap-y-1">
                        {social.map(([key, url]) => (
                          <li key={key}>
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-small text-brand underline underline-offset-4"
                            >
                              {SOCIAL_LABELS[key]}
                              <span className="sr-only"> profile of {member.name} (opens in a new tab)</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
