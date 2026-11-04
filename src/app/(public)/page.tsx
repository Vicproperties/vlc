import { siteConfig } from "@/config/site";

/**
 * Temporary holding page. The real homepage (dashboard-managed sections) is built in Stage 6.
 * No business content is invented here.
 */
export default function HomePage() {
  return (
    <section className="container-content flex flex-1 flex-col justify-center py-24 md:py-40">
      <p className="mb-6 eyebrow">{siteConfig.name}</p>
      <h1 className="max-w-3xl text-display">Our new website is being prepared.</h1>
      <div className="mt-10 h-px w-24 bg-brand-light" aria-hidden="true" />
    </section>
  );
}
