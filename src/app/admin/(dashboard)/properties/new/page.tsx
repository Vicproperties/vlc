import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Building2, Map } from "lucide-react";
import { NoAccess } from "@/components/admin/no-access";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Skeleton } from "@/components/ui/states";
import { can, requireAdmin } from "@/features/auth/admin-session";

export const metadata: Metadata = { title: "Add property" };

export default function NewPropertyPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <ChooseKind />
    </Suspense>
  );
}

async function ChooseKind() {
  const admin = await requireAdmin();
  if (!can(admin, "properties", "create")) return <NoAccess section="adding properties" />;

  const options = [
    {
      href: "/admin/properties/new/land",
      icon: Map,
      title: "Land",
      text: "Plots and acreage: land use, size, dimensions and available plots.",
    },
    {
      href: "/admin/properties/new/building",
      icon: Building2,
      title: "Building",
      text: "Houses, flats and commercial buildings: type, rooms and parking.",
    },
  ];

  return (
    <>
      <AdminPageHeader title="Add property" description="Choose what you are listing. Each type has its own form." />
      <ul className="grid gap-4 sm:grid-cols-2">
        {options.map((option) => (
          <li key={option.href}>
            <Link
              href={option.href}
              className="flex h-full flex-col gap-3 border border-line bg-paper p-6 transition-colors hover:border-brand hover:bg-brand-tint"
            >
              <option.icon className="size-6 text-brand" strokeWidth={1.5} aria-hidden="true" />
              <span className="font-serif text-h3 text-ink">{option.title}</span>
              <span className="text-small text-stone">{option.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
