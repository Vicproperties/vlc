import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ImageIcon } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { publicStorageUrl } from "@/lib/images";
import { createServiceClient } from "@/lib/supabase/service";

export const metadata: Metadata = { title: "Media library" };

/**
 * Every uploaded image, grouped by where it is used. Read-only on purpose: images are added
 * and removed where they are used (a property, an article, a page section), so removing one
 * here can never break a live page.
 */
const LIBRARIES = [
  { key: "property-media", label: "Property photos" },
  { key: "blog-media", label: "Blog images" },
  { key: "site-media", label: "Website images" },
] as const;
type Bucket = (typeof LIBRARIES)[number]["key"];

const FOLDER_LABEL: Record<string, string> = {
  sections: "Page sections",
  team: "Team photos",
  announcements: "Announcements",
};

interface MediaFile {
  path: string;
  size: number;
  created: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FOLDERS = 200;

async function listLibrary(bucket: Bucket): Promise<Array<{ folder: string; files: MediaFile[] }>> {
  const storage = createServiceClient().storage.from(bucket);
  const { data: root, error } = await storage.list("", { limit: 1000, sortBy: { column: "name", order: "asc" } });
  if (error) throw new Error("Unable to load the media library.");
  const toFile =
    (prefix: string) => (o: { name: string; created_at?: string | null; metadata?: { size?: number } | null }) => ({
      path: prefix ? `${prefix}/${o.name}` : o.name,
      size: o.metadata?.size ?? 0,
      created: o.created_at ?? null,
    });
  // Folders come back without an id; files have one.
  const folders = root.filter((o) => !o.id).slice(0, MAX_FOLDERS);
  const groups = await Promise.all(
    folders.map(async (f) => {
      const { data } = await storage.list(f.name, { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
      return {
        folder: f.name,
        files: (data ?? []).filter((o) => o.id && o.name !== ".emptyFolderPlaceholder").map(toFile(f.name)),
      };
    }),
  );
  const loose = root.filter((o) => o.id && o.name !== ".emptyFolderPlaceholder").map(toFile(""));
  return [...(loose.length ? [{ folder: "", files: loose }] : []), ...groups.filter((g) => g.files.length)];
}

function size(bytes: number): string {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function MediaPage({ searchParams }: PageProps<"/admin/media">) {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Media searchParams={searchParams} />
    </Suspense>
  );
}

async function Media({ searchParams }: { searchParams: PageProps<"/admin/media">["searchParams"] }) {
  const admin = await requireAdmin();
  if (!can(admin, "media", "view")) return <NoAccess section="the media library" />;
  const params = await searchParams;
  const bucket = LIBRARIES.find((l) => l.key === params.library)?.key ?? "property-media";
  const groups = await listLibrary(bucket);

  // Property photo folders are named after the property: show its title instead.
  const titles = new Map<string, string>();
  if (bucket === "property-media") {
    const ids = groups.map((g) => g.folder).filter((f) => UUID.test(f));
    if (ids.length) {
      const { data } = await createServiceClient().from("properties").select("id, title").in("id", ids);
      for (const p of data ?? []) titles.set(p.id, p.title);
    }
  }
  const total = groups.reduce((n, g) => n + g.files.length, 0);

  return (
    <>
      <AdminPageHeader
        title="Media library"
        description="All uploaded images. To add or remove an image, open the property, article or page where it is used."
      />
      <nav aria-label="Library" className="flex flex-wrap gap-2">
        {LIBRARIES.map((l) => (
          <Link
            key={l.key}
            href={`/admin/media?library=${l.key}`}
            aria-current={l.key === bucket ? "page" : undefined}
            className={cn(
              "border px-3 py-1.5 text-small",
              l.key === bucket ? "border-brand bg-brand-tint text-ink" : "border-line text-stone hover:text-ink",
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {total === 0 ? (
        <EmptyState icon={ImageIcon} title="No images here yet" description="Uploaded images appear here." />
      ) : (
        groups.map((g) => (
          <section key={g.folder || "root"} className="flex flex-col gap-3">
            <h2 className="text-body font-semibold text-ink">
              {titles.get(g.folder) ??
                FOLDER_LABEL[g.folder] ??
                (UUID.test(g.folder) ? "Deleted property" : g.folder || "Other")}
              <span className="font-normal text-stone"> ({g.files.length})</span>
            </h2>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {g.files.map((f) => {
                const url = publicStorageUrl(bucket, f.path);
                return (
                  <li key={f.path} className="flex flex-col gap-1.5">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="block border border-line">
                      {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails of our own storage files */}
                      <img src={url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                      <span className="sr-only">Open image in a new tab</span>
                    </a>
                    <span className="text-caption text-stone">
                      {[f.created ? formatDate(f.created) : null, size(f.size)].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
