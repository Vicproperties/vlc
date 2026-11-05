import type { Metadata } from "next";
import { Suspense } from "react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TeamManager } from "@/components/admin/team-manager";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { publicStorageUrl } from "@/lib/images";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Team" };

export default function TeamContentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <TeamContent />
    </Suspense>
  );
}

async function TeamContent() {
  const admin = await requireAdmin();
  if (!can(admin, "content", "view")) return <NoAccess section="website content" />;
  const supabase = await createClient();
  const { data } = await supabase
    .from("team_members")
    .select("id, name, position, department, bio, photo_path, social_links, is_active")
    .order("sort_order");
  return (
    <>
      <AdminPageHeader title="Team" description="Shown on the About page in this order." />
      <TeamManager
        members={(data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          position: row.position ?? "",
          department: row.department ?? "",
          bio: row.bio ?? "",
          photoUrl: row.photo_path ? publicStorageUrl("site-media", row.photo_path) : null,
          social: (row.social_links ?? {}) as Record<string, string>,
          isActive: row.is_active,
        }))}
        can={{
          create: can(admin, "content", "create"),
          edit: can(admin, "content", "edit"),
          delete: can(admin, "content", "delete"),
        }}
      />
    </>
  );
}
