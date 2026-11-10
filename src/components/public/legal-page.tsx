import Link from "next/link";
import { PageHero } from "@/components/public/page-hero";
import { getLegalPage } from "@/features/content/queries";
import { formatDate } from "@/lib/format";
import { sanitizeRichText } from "@/lib/rich-text";

/** Public legal document (only published versions are readable, enforced by RLS). */
export async function LegalPage({
  slug,
  fallbackTitle,
}: {
  slug: "privacy-policy" | "terms-and-conditions";
  fallbackTitle: string;
}) {
  const page = await getLegalPage(slug);
  const html = page?.content_html ? sanitizeRichText(page.content_html, { document: true }) : "";

  return (
    <article className="flex flex-col">
      <PageHero
        eyebrow="Legal"
        title={page?.title ?? fallbackTitle}
        text={page ? `Last updated ${formatDate(page.updated_at)}` : undefined}
      />
      <div className="container-content py-14 md:py-20">
        {html ? (
          <div
            className="rich-text legal mx-auto max-w-3xl rounded-[2rem] border border-line bg-white p-6 text-body text-ink shadow-card sm:p-10 md:p-14"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="mx-auto max-w-3xl text-body text-stone">
            This page is being prepared. If you have a question in the meantime, please{" "}
            <Link href="/contact" className="text-brand underline underline-offset-4">
              contact us
            </Link>
            .
          </p>
        )}
      </div>
    </article>
  );
}
