import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { signOutCustomerAction } from "@/features/customers/actions";
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
        <Notice tone="info">This is a staff account. Customer features use a separate personal Google account.</Notice>
      </div>
    );
  }
  const customer = await requireCustomer();
  if (!customer) redirect("/account/login");

  return (
    <div className="container-content grid gap-10 py-12 md:py-16 lg:grid-cols-[15rem_1fr] lg:gap-14">
      <aside className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          {customer.profile.avatar_url && (
            // eslint-disable-next-line @next/next/no-img-element -- Google profile photo (small, external)
            <img
              src={customer.profile.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              className="size-10 object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{customer.profile.full_name ?? "Your account"}</p>
            {customer.email && <p className="truncate text-caption text-stone">{customer.email}</p>}
          </div>
        </div>
        <nav aria-label="Account">
          <ul className="flex flex-row flex-wrap gap-x-5 gap-y-2 lg:flex-col lg:gap-1">
            {TABS.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={tab.href === current ? "page" : undefined}
                  className={cn(
                    "block border-l-2 py-1.5 text-small lg:px-4",
                    tab.href === current
                      ? "border-brand font-medium text-ink"
                      : "border-transparent text-stone hover:text-ink",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action={signOutCustomerAction}>
          <Button type="submit" variant="link">
            Sign out
          </Button>
        </form>
      </aside>
      <div className="flex min-w-0 flex-col gap-8">
        <h1 className="text-h2">{title}</h1>
        {children(customer)}
      </div>
    </div>
  );
}
