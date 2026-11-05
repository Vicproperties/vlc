import type { Metadata } from "next";
import { Suspense } from "react";
import { ListManager } from "@/components/admin/list-manager";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "FAQ" };

export default function FaqContentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <FaqContent />
    </Suspense>
  );
}

async function FaqContent() {
  const admin = await requireAdmin();
  if (!can(admin, "content", "view")) return <NoAccess section="website content" />;
  const supabase = await createClient();
  const { data } = await supabase.from("faqs").select("id, question, answer, is_active").order("sort_order");
  return (
    <>
      <AdminPageHeader title="Frequently asked questions" description="Shown on the FAQ page in this order." />
      <ListManager
        kind="faqs"
        labels={{ item: "question", a: "Question", b: "Answer", aField: "question", bField: "answer", bLong: true }}
        items={(data ?? []).map((row) => ({ id: row.id, a: row.question, b: row.answer, isActive: row.is_active }))}
        can={{
          create: can(admin, "content", "create"),
          edit: can(admin, "content", "edit"),
          delete: can(admin, "content", "delete"),
        }}
      />
    </>
  );
}
