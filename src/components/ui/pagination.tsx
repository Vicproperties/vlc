import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Link-based pagination (works without JavaScript and is crawlable).
 * `hrefFor(page)` builds the URL, preserving any active filters.
 */
export interface PaginationProps {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
  className?: string;
}

export function pageWindow(page: number, totalPages: number): Array<number | "gap"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const result: Array<number | "gap"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) result.push("gap");
    result.push(p);
  });
  return result;
}

const itemBase = "flex h-10 min-w-10 items-center justify-center px-3 text-small transition-colors";

export function Pagination({ page, totalPages, hrefFor, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const prev = page > 1 ? page - 1 : null;
  const next = page < totalPages ? page + 1 : null;

  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-center gap-1", className)}>
      {prev ? (
        <Link href={hrefFor(prev)} className={cn(itemBase, "gap-1 text-ink hover:bg-forest-tint")} rel="prev">
          <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Previous
        </Link>
      ) : (
        <span className={cn(itemBase, "gap-1 text-stone/60")} aria-disabled="true">
          <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Previous
        </span>
      )}
      <ul className="hidden items-center gap-1 sm:flex">
        {pageWindow(page, totalPages).map((p, i) =>
          p === "gap" ? (
            <li key={`gap-${i}`} className={cn(itemBase, "text-stone")} aria-hidden="true">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  itemBase,
                  p === page
                    ? "border-b-2 border-forest font-medium text-ink"
                    : "text-stone hover:bg-forest-tint hover:text-ink",
                )}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ul>
      <span className="px-3 text-small text-stone sm:hidden">
        Page {page} of {totalPages}
      </span>
      {next ? (
        <Link href={hrefFor(next)} className={cn(itemBase, "gap-1 text-ink hover:bg-forest-tint")} rel="next">
          Next
          <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(itemBase, "gap-1 text-stone/60")} aria-disabled="true">
          Next
          <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
        </span>
      )}
    </nav>
  );
}
