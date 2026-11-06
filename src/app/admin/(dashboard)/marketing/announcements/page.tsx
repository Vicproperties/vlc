import type { Metadata } from "next";
import { Suspense } from "react";
import { type AnnouncementRow, AnnouncementManager } from "@/components/admin/marketing-manager";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { publicStorageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Announcement pop-up" };

export default function AnnouncementsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Announcements />
    </Suspense>
  );
}

async function Announcements() {
  const admin = await requireAdmin();
  if (!can(admin, "marketing", "view")) return <NoAccess section="marketing" />;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(
      "id, heading, message, image_path, image_alt, cta_label, cta_url, frequency, frequency_days, priority, starts_at, ends_at, is_active",
    )
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Unable to load announcements.");
  const items: AnnouncementRow[] = data.map((a) => ({
    id: a.id,
    heading: a.heading,
    message: a.message ?? "",
    imageUrl: a.image_path ? publicStorageUrl("site-media", a.image_path) : null,
    imageAlt: a.image_alt ?? "",
    ctaLabel: a.cta_label ?? "",
    ctaUrl: a.cta_url ?? "",
    frequency: a.frequency,
    frequencyDays: a.frequency_days,
    priority: a.priority,
    startsAt: a.starts_at,
    endsAt: a.ends_at,
    isActive: a.is_active,
  }));
  return (
    <>
      <AdminPageHeader
        title="Announcement pop-up"
        description="A pop-up shown shortly after visitors arrive. When several are switched on, the highest priority shows."
      />
      <AnnouncementManager
        items={items}
        can={{
          create: can(admin, "marketing", "create"),
          edit: can(admin, "marketing", "edit"),
          delete: can(admin, "marketing", "delete"),
        }}
      />
    </>
  );
}
