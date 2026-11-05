import Link from "next/link";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { LegalEditor } from "@/components/admin/legal-editor";
import { can, requireAdmin } from "@/features/auth/admin-session";
import { type LegalSlug, saveLegalPageAction } from "@/features/content/actions";
import { PRIVACY_POLICY_DRAFT } from "@/features/content/legal-drafts";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const DEFAULT_TITLES: Record<LegalSlug, string> = {
  "privacy-policy": "Privacy Policy",
  "terms-and-conditions": "Terms and Conditions",
};

/** Shared dashboard page for the two legal documents. */
export async function LegalPageAdmin({ slug }: { slug: LegalSlug }) {
  const admin = await requireAdmin();
  if (!can(admin, "content", "view")) return <NoAccess section="website content" />;
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("legal_pages")
    .select("title, content_html, is_published, needs_legal_review, version, last_reviewed_at, updated_at")
    .eq("slug", slug)
    .maybeSingle();

  return (
    <>
      <AdminPageHeader
        title={DEFAULT_TITLES[slug]}
        description={
          <>
            {page ? `Version ${page.version} · last saved ${formatDate(page.updated_at)}` : "Not written yet"}
            {page?.last_reviewed_at && ` · legal review confirmed ${formatDate(page.last_reviewed_at)}`} ·{" "}
            <Link href={`/${slug}`} className="underline underline-offset-4">
              View on the website
            </Link>
          </>
        }
      />
      {can(admin, "content", "edit") ? (
        <LegalEditor
          action={saveLegalPageAction.bind(null, slug)}
          title={page?.title ?? DEFAULT_TITLES[slug]}
          html={page?.content_html ?? ""}
          isPublished={page?.is_published ?? false}
          needsReview={page?.needs_legal_review ?? true}
          draft={slug === "privacy-policy" ? PRIVACY_POLICY_DRAFT : undefined}
        />
      ) : (
        <p className="text-small text-stone">You can view this page but not edit it.</p>
      )}
    </>
  );
}
