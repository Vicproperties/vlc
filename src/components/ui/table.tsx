import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Data table primitives for the admin dashboard. Horizontal scroll on narrow screens. */
export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="w-full overflow-x-auto border border-line bg-surface">
      <table className={cn("w-full border-collapse text-left text-small", className)} {...props} />
    </div>
  );
}

export function THead(props: ComponentProps<"thead">) {
  return <thead className="border-b border-line bg-paper" {...props} />;
}

export function TBody(props: ComponentProps<"tbody">) {
  return <tbody className="divide-y divide-line" {...props} />;
}

export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-paper/60", className)} {...props} />;
}

export function TH({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-caption font-medium tracking-[0.1em] whitespace-nowrap text-stone uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function TD({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("px-4 py-3.5 align-middle text-ink", className)} {...props} />;
}
