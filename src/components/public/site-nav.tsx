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

export function DesktopNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-9">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative py-2 text-small tracking-[0.02em] transition-colors",
                  "after:absolute after:inset-x-0 after:-bottom-px after:h-px after:origin-left after:bg-forest after:transition-transform after:duration-200",
                  active
                    ? "text-ink after:scale-x-100"
                    : "text-stone after:scale-x-0 hover:text-ink hover:after:scale-x-100",
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
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="-mr-2 flex size-11 items-center justify-center text-ink"
      >
        <Menu className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Menu" variant="drawer-right">
        <nav aria-label="Main">
          <ul className="flex flex-col">
            {items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href} className="border-b border-line">
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn("block py-4 font-serif text-h3", active ? "text-forest" : "text-ink")}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Dialog>
    </div>
  );
}
