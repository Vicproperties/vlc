import Image from "next/image";
import { ChevronDown, Quote } from "lucide-react";
import { Eyebrow } from "@/components/public/page-hero";
import { SocialLinks } from "@/components/public/social-icons";
import { publicStorageUrl } from "@/lib/images";

export interface TeamMember {
  id: string;
  name: string;
  position: string | null;
  department: string | null;
  bio: string | null;
  photo_path: string | null;
  social_links: unknown;
}

const BIO_PREVIEW = 220;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

function socialOf(member: TeamMember): Array<[string, string]> {
  const links = member.social_links && typeof member.social_links === "object" ? member.social_links : {};
  return Object.entries(links as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
}

/** A long biography shows its opening; the rest opens with "Read full biography". */
function Bio({ text }: { text: string }) {
  if (text.length <= BIO_PREVIEW + 40) return <p className="text-small whitespace-pre-line text-stone">{text}</p>;
  const preview = `${text.slice(0, BIO_PREVIEW).replace(/\s+\S*$/, "")}…`;
  return (
    <div className="group/bio flex flex-col">
      <p className="text-small text-stone group-has-[details[open]]/bio:hidden">{preview}</p>
      <details className="group/more flex flex-col">
        <summary className="mt-2 inline-flex cursor-pointer list-none items-center gap-1 text-small font-semibold text-brand [&::-webkit-details-marker]:hidden">
          <span className="group-open/more:hidden">Read full biography</span>
          <span className="hidden group-open/more:inline">Show less</span>
          <ChevronDown className="size-4 transition-transform group-open/more:rotate-180" aria-hidden="true" />
        </summary>
        <p className="mt-2 text-small whitespace-pre-line text-stone">{text}</p>
      </details>
    </div>
  );
}

export function TeamCard({ member }: { member: TeamMember }) {
  const role = [member.position, member.department].filter(Boolean);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] rounded-tr-md border border-line/70 bg-white shadow-card transition-[box-shadow,transform] duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <div className="relative aspect-[4/5] overflow-hidden bg-brand-tint">
        {member.photo_path ? (
          <Image
            src={publicStorageUrl("site-media", member.photo_path)}
            alt={`Photo of ${member.name}`}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <span aria-hidden="true" className="text-[4rem] font-bold tracking-[-0.04em] text-brand/70">
              {initials(member.name)}
            </span>
          </div>
        )}
        {member.department && (
          <span className="absolute top-4 left-4 rounded-full bg-white/95 px-3 py-1 text-caption font-semibold text-brand shadow-card">
            {member.department}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <span
          aria-hidden="true"
          className="h-1 w-10 rounded-full bg-brand-light transition-[width,background-color] duration-300 group-hover:w-16 group-hover:bg-brand"
        />
        <div className="flex flex-col gap-1">
          <h3 className="text-h4 font-bold text-ink">{member.name}</h3>
          {member.position && <p className="text-small font-semibold text-brand-mid">{member.position}</p>}
          {!member.position && role.length > 0 && <p className="sr-only">{role.join(", ")}</p>}
        </div>
        {member.bio && <Bio text={member.bio} />}
        <SocialLinks links={socialOf(member)} who={member.name} className="mt-auto pt-2" />
      </div>
    </article>
  );
}

export function TeamGrid({ members }: { members: TeamMember[] }) {
  return (
    <ul data-reveal-stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {members.map((member) => (
        <li key={member.id}>
          <TeamCard member={member} />
        </li>
      ))}
    </ul>
  );
}

/** About page: the CEO introduction, from Website Content → About → CEO. */
export function CeoSection({
  heading,
  name,
  designation,
  bio,
  photoUrl,
}: {
  heading?: string;
  name: string;
  designation?: string;
  bio?: string;
  photoUrl: string | null;
}) {
  return (
    <section className="container-content py-20 md:py-28" aria-labelledby="ceo-heading">
      <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
        <div className="relative mx-auto w-full max-w-md">
          <span
            aria-hidden="true"
            className="absolute -top-5 -left-5 -z-10 h-3/4 w-3/4 rounded-[2rem] bg-brand-light md:-top-7 md:-left-7"
          />
          {photoUrl ? (
            <div
              data-reveal="image"
              className="relative aspect-[4/5] overflow-hidden rounded-[2rem] rounded-br-md bg-brand-tint shadow-overlay"
            >
              <Image
                src={photoUrl}
                alt={`Photo of ${name}`}
                fill
                sizes="(min-width: 1024px) 28rem, 90vw"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="flex aspect-[4/5] items-center justify-center rounded-[2rem] rounded-br-md bg-brand-tint">
              <span aria-hidden="true" className="text-[6rem] font-bold tracking-[-0.04em] text-brand/70">
                {initials(name)}
              </span>
            </div>
          )}
          <div
            data-reveal
            className="absolute -right-2 -bottom-6 max-w-[80%] rounded-2xl bg-brand px-6 py-4 text-white shadow-overlay sm:-right-6"
          >
            <p className="text-body font-bold">{name}</p>
            {designation && <p className="text-small text-brand-light">{designation}</p>}
          </div>
        </div>
        <div className="flex flex-col gap-6 pt-6 lg:pt-0" data-reveal>
          <Eyebrow>Leadership</Eyebrow>
          <h2 id="ceo-heading" className="text-h2">
            {heading ?? "Meet our CEO"}
          </h2>
          {bio && (
            <div className="relative">
              <Quote
                className="absolute -top-2 -left-1 size-12 -scale-x-100 text-brand-light"
                strokeWidth={1.25}
                aria-hidden="true"
              />
              <p className="relative pt-8 text-body-lg whitespace-pre-line text-stone">{bio}</p>
            </div>
          )}
          <div className="flex items-center gap-4 pt-2">
            <span aria-hidden="true" className="h-px w-12 bg-brand" />
            <p className="text-small">
              <span className="font-bold text-ink">{name}</span>
              {designation && <span className="text-stone"> · {designation}</span>}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
