"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import type { NavItem } from "@/config/site";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui/dialog";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The current path is only known at request time, so the hook-based components are wrapped
 * in Suspense by the header; the fallbacks render the same links without the active state.
 */
export function DesktopNav({ items }: { items: NavItem[] }) {
  return <DesktopNavLinks items={items} pathname={usePathname()} />;
}

export function DesktopNavLinks({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-0.5 lg:gap-1.5">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-2.5 py-2 text-small font-medium transition-colors lg:px-3",
                  "after:absolute after:inset-x-3 after:bottom-0.5 after:h-0.5 after:rounded-full after:bg-brand after:transition-transform after:duration-200",
                  active ? "text-brand after:scale-x-100" : "text-stone after:scale-x-0 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function MobileNav({ items }: { items: NavItem[] }) {
  return <MobileNavMenu items={items} pathname={usePathname()} />;
}

export function MobileNavMenu({ items, pathname }: { items: NavItem[]; pathname: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="-mr-1 flex size-10 items-center justify-center rounded-xl text-ink hover:bg-brand-tint"
      >
        <Menu className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Menu" variant="drawer-right">
        <nav aria-label="Main">
          {/* Account and search links are in the menu on small screens. */}
          <ul className="flex flex-col">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="border-b border-line">
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn("block py-4 text-h4 font-semibold", active ? "text-brand" : "text-ink")}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            <li className="border-b border-line">
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="block py-4 text-h4 font-semibold text-ink"
              >
                My account
              </Link>
            </li>
          </ul>
        </nav>
      </Dialog>
    </div>
  );
}
