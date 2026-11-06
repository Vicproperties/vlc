import type { Metadata } from "next";
import { Suspense } from "react";
import { type BannerRow, BannerManager } from "@/components/admin/marketing-manager";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Top banner" };

export default function BannerPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Banners />
    </Suspense>
  );
}

async function Banners() {
  const admin = await requireAdmin();
  if (!can(admin, "marketing", "view")) return <NoAccess section="marketing" />;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("top_banners")
    .select("id, message, type, link_url, cta_label, starts_at, ends_at, is_active")
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Unable to load banners.");
  const banners: BannerRow[] = data.map((b) => ({
    id: b.id,
    message: b.message,
    type: b.type,
    linkUrl: b.link_url ?? "",
    ctaLabel: b.cta_label ?? "",
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    isActive: b.is_active,
  }));
  return (
    <>
      <AdminPageHeader title="Top banner" description="A thin strip above the menu on every page of the website." />
      <BannerManager
        banners={banners}
        can={{
          create: can(admin, "marketing", "create"),
          edit: can(admin, "marketing", "edit"),
          delete: can(admin, "marketing", "delete"),
        }}
      />
    </>
  );
}
