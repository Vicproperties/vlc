import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";

export const metadata: Metadata = { title: "Website content" };

const PAGES = [
  {
    href: "/admin/content/home",
    title: "Home",
    text: "Headline, featured properties heading and reasons to choose you.",
  },
  { href: "/admin/content/about", title: "About", text: "About text, mission, vision and core values." },
  { href: "/admin/content/team", title: "Team", text: "Team members with photos, shown on the About page." },
  { href: "/admin/content/contact", title: "Contact", text: "Contact page introduction." },
  { href: "/admin/content/faq", title: "FAQ", text: "Frequently asked questions and answers." },
  { href: "/admin/content/privacy-policy", title: "Privacy Policy", text: "Needs legal review before publishing." },
  { href: "/admin/content/terms", title: "Terms & Conditions", text: "Needs legal review before publishing." },
];

export default function ContentPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ContentOverview />
    </Suspense>
  );
}

async function ContentOverview() {
  const admin = await requireAdmin();
  if (!can(admin, "content", "view")) return <NoAccess section="website content" />;
  return (
    <>
      <AdminPageHeader title="Website content" description="Changes appear on the website as soon as they are saved." />
      <ul className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
        {PAGES.map((page) => (
          <li key={page.href} className="bg-paper">
            <Link href={page.href} className="flex h-full flex-col gap-2 p-6 transition-colors hover:bg-brand-tint">
              <span className="font-serif text-h4 text-ink">{page.title}</span>
              <span className="text-small text-stone">{page.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      {can(admin, "settings", "view") && (
        <p className="text-small text-stone">
          Phone numbers, email, address, opening hours and social links are in{" "}
          <Link href="/admin/settings" className="text-brand underline underline-offset-4">
            Website Settings
          </Link>
          .
        </p>
      )}
    </>
  );
}
