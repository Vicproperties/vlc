import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ContentSections } from "@/components/admin/content-sections";
import { ListManager } from "@/components/admin/list-manager";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "About page content" };

export default function AboutContentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <AboutContent />
    </Suspense>
  );
}

async function AboutContent() {
  const admin = await requireAdmin();
  if (!can(admin, "content", "view")) return <NoAccess section="website content" />;
  const supabase = await createClient();
  const { data } = await supabase.from("core_values").select("id, title, description, is_active").order("sort_order");

  return (
    <>
      <AdminPageHeader
        title="About page"
        description={
          <>
            About text, mission, vision and core values. Team members are managed under{" "}
            <Link href="/admin/content/team" className="underline underline-offset-4">
              Team
            </Link>
            .
          </>
        }
      />
      <ContentSections page="about" canEdit={can(admin, "content", "edit")} />
      <section className="flex flex-col gap-4 border-t border-line pt-8">
        <h2 className="text-body font-semibold text-ink">Core values</h2>
        <ListManager
          kind="core_values"
          labels={{ item: "value", a: "Value", b: "Description", aField: "title", bField: "description" }}
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
