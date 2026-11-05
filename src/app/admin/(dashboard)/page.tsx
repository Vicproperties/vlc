import Link from "next/link";
import { Suspense } from "react";
import { LayoutDashboard } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { enquiryCounts } from "@/features/enquiries/admin";

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <Overview />
    </Suspense>
  );
}

/** Real counts only, for the sections this admin may see. More figures arrive in later stages. */
async function Overview() {
  const admin = await requireAdmin();
  const firstName = admin.fullName.split(/\s+/)[0];
  const permissions = { inspections: can(admin, "inspections", "view"), enquiries: can(admin, "enquiries", "view") };
  const counts = await enquiryCounts(permissions);

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
