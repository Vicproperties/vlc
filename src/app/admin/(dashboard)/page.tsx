import Link from "next/link";
import { Suspense } from "react";
import { LayoutDashboard } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { visitorsLastWeek } from "@/features/analytics/summary";
import { enquiryCounts } from "@/features/enquiries/admin";
import { createClient } from "@/lib/supabase/server";

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <Overview />
    </Suspense>
  );
}

/** Real counts only, for the sections this admin may see. */
async function Overview() {
  const admin = await requireAdmin();
  const firstName = admin.fullName.split(/\s+/)[0];
  const permissions = { inspections: can(admin, "inspections", "view"), enquiries: can(admin, "enquiries", "view") };
  const show = {
    properties: can(admin, "properties", "view"),
    blog: can(admin, "blog", "view"),
    analytics: can(admin, "analytics", "view"),
    newsletter: can(admin, "newsletter", "view"),
  };
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;
  const [counts, published, drafts, articles, subscribers, visitors] = await Promise.all([
    enquiryCounts(permissions),
    show.properties ? supabase.from("properties").select("id", head).eq("status", "published") : null,
    show.properties ? supabase.from("properties").select("id", head).eq("status", "draft") : null,
    show.blog ? supabase.from("blog_posts").select("id", head).eq("status", "published") : null,
    show.newsletter ? supabase.from("newsletter_subscribers").select("id", head).eq("status", "active") : null,
    show.analytics ? visitorsLastWeek() : null,
  ]);

  const tiles = [
    permissions.inspections && {
      label: "Pending inspection requests",
      value: counts.pendingInspections ?? 0,
      href: "/admin/inspections?status=pending",
    },
    permissions.enquiries && {
      label: "Unread contact messages",
      value: counts.unreadMessages ?? 0,
      href: "/admin/inspections/messages",
    },
    show.properties && {
      label: "Published properties",
      value: published?.count ?? 0,
      href: "/admin/properties?status=published",
    },
    show.properties && { label: "Draft properties", value: drafts?.count ?? 0, href: "/admin/properties?status=draft" },
    show.blog && { label: "Published articles", value: articles?.count ?? 0, href: "/admin/blog" },
    show.analytics && { label: "Visitors in the last 7 days", value: visitors ?? 0, href: "/admin/analytics?days=7" },
    show.newsletter && {
      label: "Newsletter subscribers",
      value: subscribers?.count ?? 0,
      href: "/admin/marketing/newsletter",
    },
  ].filter(Boolean) as Array<{ label: string; value: number; href: string }>;

  return (
    <>
      <AdminPageHeader title={`Welcome, ${firstName}`} description="Operational summary of the website." />
      {tiles.length ? (
        <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <li key={tile.href} className="bg-paper">
              <Link href={tile.href} className="flex h-full flex-col gap-2 p-6 transition-colors hover:bg-brand-tint">
                <span className="text-small text-stone">{tile.label}</span>
                <span className="font-serif text-h1 text-ink">{tile.value}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={LayoutDashboard}
          title="Nothing to summarise yet"
          description="Figures for the sections you can access appear here."
        />
      )}
    </>
  );
}
