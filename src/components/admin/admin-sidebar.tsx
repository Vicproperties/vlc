"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu } from "lucide-react";
import { adminNav, type AdminModule, type AdminNavItem } from "@/config/admin-nav";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/cn";
import { Dialog } from "@/components/ui/dialog";

function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  return path === "/admin" ? pathname === "/admin" : pathname === path || pathname.startsWith(`${path}/`);
}

function NavList({ items, onNavigate }: { items: AdminNavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 border-l-2 px-4 py-2.5 text-small transition-colors",
                active
                  ? "border-forest bg-forest-tint font-medium text-ink"
                  : "border-transparent text-stone hover:bg-paper hover:text-ink",
              )}
            >
              <Icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              {item.label}
            </Link>
            {active && item.children && (
              <ul className="mt-1 mb-2 flex flex-col">
                {item.children.map((child) => (
                  <li key={child.href}>
                    <Link
                      href={child.href}
                      onClick={onNavigate}
                      className="block py-1.5 pr-4 pl-11 text-small text-stone transition-colors hover:text-ink"
                    >
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  return (
    <div className="flex flex-col gap-0.5 px-4">
      <span className="font-serif text-h4 text-ink">{siteConfig.name}</span>
      <span className="text-caption tracking-[0.14em] text-stone uppercase">Administration</span>
    </div>
  );
}

/**
 * The server passes only the module keys the current admin may view (plain strings), never
 * component references. Hiding items is a UX convenience; authorization is enforced server-side.
 */
function visibleItems(allowedModules?: ReadonlyArray<AdminModule>): AdminNavItem[] {
  return allowedModules ? adminNav.filter((item) => allowedModules.includes(item.module)) : adminNav;
}

export function AdminSidebar({ allowedModules }: { allowedModules?: ReadonlyArray<AdminModule> }) {
  const items = visibleItems(allowedModules);
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 overflow-y-auto border-r border-line bg-surface py-6 lg:flex">
      <Brand />
      <nav aria-label="Dashboard">
        <NavList items={items} />
      </nav>
    </aside>
  );
}

export function AdminMobileNav({ allowedModules }: { allowedModules?: ReadonlyArray<AdminModule> }) {
  const [open, setOpen] = useState(false);
  const items = visibleItems(allowedModules);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open dashboard menu"
        aria-expanded={open}
        className="-ml-2 flex size-10 items-center justify-center text-ink"
      >
        <Menu className="size-5" strokeWidth={1.5} aria-hidden="true" />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Dashboard"
        variant="drawer-left"
        className="[&>div:nth-child(2)]:px-0"
      >
        <nav aria-label="Dashboard">
          <NavList items={items} onNavigate={() => setOpen(false)} />
        </nav>
      </Dialog>
    </div>
  );
}
