import Link from "next/link";
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
    <article className="container-content flex flex-col gap-8 py-12 md:py-20">
      <header className="flex max-w-3xl flex-col gap-3">
        <h1 className="text-h1">{page?.title ?? fallbackTitle}</h1>
        {page && <p className="text-small text-stone">Last updated {formatDate(page.updated_at)}</p>}
      </header>
      {html ? (
        <div className="rich-text legal max-w-3xl text-body text-ink" dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <p className="max-w-3xl text-body text-stone">
          This page is being prepared. If you have a question in the meantime, please{" "}
          <Link href="/contact" className="text-brand underline underline-offset-4">
            contact us
          </Link>
          .
        </p>
      )}
    </article>
  );
}
