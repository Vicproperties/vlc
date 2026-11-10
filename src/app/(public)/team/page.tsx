import type { Metadata } from "next";
import { Suspense } from "react";
import { Users } from "lucide-react";
import { ContactSection } from "@/components/public/home-sections";
import { PageHero } from "@/components/public/page-hero";
import { TeamGrid } from "@/components/public/team";
import { EmptyState } from "@/components/ui/states";
import { siteConfig } from "@/config/site";
import { getPageSections, getTeamMembers } from "@/features/content/queries";
import { findSection, readContent } from "@/features/content/sections";

export const metadata: Metadata = {
  title: "Our team",
  description: `Meet the people behind ${siteConfig.name}.`,
  alternates: { canonical: "/team" },
};

/**
 * Team page. Members are the active ones from Website Content → Team; the heading and
 * introduction are the "Team" section of the About page content.
 */
export default async function TeamPage() {
  const [sections, members] = await Promise.all([getPageSections("about"), getTeamMembers()]);
  const head = readContent(findSection("about", "team")!, sections.team);

  return (
    <div className="flex flex-col">
      <PageHero
        eyebrow="Our team"
        title={head.heading ?? "Meet the team"}
        text={head.text ?? `The people behind ${siteConfig.name}.`}
      />
      <section className="container-content py-20 md:py-28" aria-label="Team members">
        {members.length ? (
          <TeamGrid members={members} />
        ) : (
          <EmptyState icon={Users} title="Our team" description="Team members will appear here soon." />
        )}
      </section>
      <Suspense fallback={null}>
        <ContactSection />
      </Suspense>
    </div>
  );
}
