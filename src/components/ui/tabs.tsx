"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

/** WAI-ARIA tabs with arrow-key, Home and End navigation. */
export function Tabs({ items, defaultTab, className }: { items: TabItem[]; defaultTab?: string; className?: string }) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);
  const baseId = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: KeyboardEvent, index: number) {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % items.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    setActive(items[next].id);
    refs.current[next]?.focus();
  }

  return (
    <div className={className}>
      <div role="tablist" className="flex gap-8 overflow-x-auto border-b border-line">
        {items.map((item, index) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                refs.current[index] = el;
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(item.id)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={cn(
                "-mb-px border-b-2 py-3 text-small font-medium whitespace-nowrap transition-colors",
                selected ? "border-forest text-ink" : "border-transparent text-stone hover:text-ink",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${baseId}-panel-${item.id}`}
          aria-labelledby={`${baseId}-tab-${item.id}`}
          hidden={item.id !== active}
          tabIndex={0}
          className="pt-6 focus-visible:outline-offset-4"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
