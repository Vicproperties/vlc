import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Notice } from "@/components/ui/notice";
import { SignOutButton } from "./account-forms";
import { requireCustomer, getCustomer, type CustomerSession } from "@/features/customers/session";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/account", label: "My profile" },
  { href: "/account/favourites", label: "My favourites" },
  { href: "/account/inspections", label: "My inspection requests" },
  { href: "/account/settings", label: "Account settings" },
] as const;

/**
 * Shared frame for the customer account pages. Staff accounts are refused here (separate
 * authentication, owner brief); signed-out visitors are sent to sign in.
 */
export async function AccountShell({
  current,
  title,
  children,
}: {
  current: (typeof TABS)[number]["href"];
  title: string;
  children: (customer: CustomerSession & { profile: NonNullable<CustomerSession["profile"]> }) => ReactNode;
}) {
  const session = await getCustomer();
  if (!session) redirect(`/account/login?next=${encodeURIComponent(current)}`);
  if (session.isStaff) {
    return (
      <div className="container-content py-16">
        <Notice tone="info">
          This is a staff account. Staff sign in to the dashboard; customer features need a separate customer account.
        </Notice>
      </div>
    );
  }
  const customer = await requireCustomer();
  if (!customer) redirect("/account/login");

  return (
    <div className="container-content grid gap-10 py-12 md:py-16 lg:grid-cols-[15rem_1fr] lg:gap-14">
      <aside className="flex flex-col gap-6 self-start rounded-[1.75rem] border border-line bg-white p-5 shadow-card lg:sticky lg:top-28">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-small font-bold text-white"
          >
            {(customer.profile.full_name ?? customer.email ?? "?").trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{customer.profile.full_name ?? "Your account"}</p>
            {customer.email && <p className="truncate text-caption text-stone">{customer.email}</p>}
          </div>
        </div>
        <nav aria-label="Account">
          <ul className="flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-1">
            {TABS.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={tab.href === current ? "page" : undefined}
                  className={cn(
                    "block rounded-xl px-3.5 py-2 text-small transition-colors",
                    tab.href === current
                      ? "bg-brand font-semibold text-white"
                      : "bg-brand-tint text-brand hover:bg-brand-light lg:bg-transparent lg:text-stone lg:hover:bg-brand-tint lg:hover:text-brand",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <SignOutButton variant="link" />
      </aside>
      <div className="flex min-w-0 flex-col gap-8">
        <h1 className="text-h2">{title}</h1>
        {children(customer)}
      </div>
    </div>
  );
}
