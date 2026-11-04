"use client";

import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";

/** Opens the filter form in a drawer on small screens. */
export function MobileFilters({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        leadingIcon={<SlidersHorizontal className="size-4" strokeWidth={1.5} aria-hidden="true" />}
      >
        {activeCount ? `Filters (${activeCount})` : "Filters"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Filter properties" variant="drawer-left">
        {children}
      </Dialog>
    </div>
  );
}

/** Sort order; changes apply immediately (the filter form also keeps the current sort). */
export function SortMenu({
  value,
  options,
}: {
  value: string;
  options: Array<{ value: string; label: string; href: string }>;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor="sort" className="text-small whitespace-nowrap text-stone">
        Sort by
      </label>
      <Select
        id="sort"
        value={value}
        className="h-10 w-auto text-small"
        options={options.map(({ value: v, label }) => ({ value: v, label }))}
        onChange={(event) => {
          const target = options.find((option) => option.value === event.target.value);
          if (target) router.push(target.href, { scroll: false });
        }}
      />
    </div>
  );
}
