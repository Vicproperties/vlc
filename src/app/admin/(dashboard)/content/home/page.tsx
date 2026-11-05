import type { Metadata } from "next";
import { Suspense } from "react";
import { ContentSections } from "@/components/admin/content-sections";
import { ListManager } from "@/components/admin/list-manager";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home page content" };

export default function HomeContentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const admin = await requireAdmin();
  if (!can(admin, "content", "view")) return <NoAccess section="website content" />;
  const supabase = await createClient();
  const { data } = await supabase
    .from("why_choose_us_items")
    .select("id, title, description, is_active")
    .order("sort_order");

  return (
    <>
      <AdminPageHeader
        title="Home page"
        description="Text on the homepage. Property listings are managed under Properties."
      />
      <ContentSections page="home" canEdit={can(admin, "content", "edit")} />
      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <h2 className="text-body font-semibold text-ink">Reasons to choose you</h2>
        <ListManager
          kind="why_choose_us_items"
          labels={{ item: "reason", a: "Title", b: "Description", aField: "title", bField: "description" }}
          items={(data ?? []).map((row) => ({
            id: row.id,
            a: row.title,
            b: row.description ?? "",
            isActive: row.is_active,
          }))}
          can={{
            create: can(admin, "content", "create"),
            edit: can(admin, "content", "edit"),
            delete: can(admin, "content", "delete"),
          }}
        />
      </section>
    </>
  );
}
