import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { JsonLd } from "@/components/public/json-ld";
import { getFaqs } from "@/features/content/queries";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description: "Answers to common questions about buying, renting and leasing land and buildings.",
  alternates: { canonical: "/faq" },
};

/** FAQ page: native disclosure widgets (keyboard and screen-reader friendly, no JavaScript). */
export default async function FaqPage() {
  const faqs = await getFaqs();
  return (
    <div className="container-content flex flex-col gap-10 py-12 md:py-20">
      {faqs.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: { "@type": "Answer", text: faq.answer },
            })),
          }}
        />
      )}
      <div className="flex max-w-2xl flex-col gap-3">
        <h1 className="text-h1">Frequently asked questions</h1>
        <p className="text-body text-stone">
          Can’t find what you need?{" "}
          <Link href="/contact" className="text-brand underline underline-offset-4">
            Contact us
          </Link>
          .
        </p>
      </div>
      {faqs.length ? (
        <div className="max-w-3xl border-t border-line">
          {faqs.map((faq) => (
            <details key={faq.id} className="group border-b border-line">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-5 font-serif text-h4 text-ink [&::-webkit-details-marker]:hidden">
                {faq.question}
                <ChevronDown
                  className="mt-1 size-5 shrink-0 text-stone transition-transform group-open:rotate-180"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </summary>
              <p className="pb-6 text-body whitespace-pre-line text-ink">{faq.answer}</p>
            </details>
          ))}
        </div>
      ) : (
        <p className="text-body text-stone">Questions and answers will appear here soon.</p>
      )}
    </div>
  );
}
