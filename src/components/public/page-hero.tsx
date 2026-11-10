import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Thin concentric rings: the brand's decorative motif (no images, no gradients). */
export function Rings({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" fill="none" aria-hidden="true" className={cn("pointer-events-none absolute", className)}>
      {[60, 105, 150, 195].map((r) => (
        <circle key={r} cx="200" cy="200" r={r} stroke="currentColor" strokeWidth="1" />
      ))}
    </svg>
  );
}

/** Small uppercase label above a heading. `tone="dark"` for use on purple. */
export function Eyebrow({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "dark" }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2.5 text-caption font-semibold tracking-[0.16em] uppercase",
        tone === "light" ? "text-brand-mid" : "text-brand-light",
      )}
    >
      <span aria-hidden="true" className={cn("h-px w-8", tone === "light" ? "bg-brand-mid" : "bg-brand-light")} />
      {children}
    </p>
  );
}

/**
 * Banner at the top of inner pages: a rounded Russian Purple panel with lavender accents.
 * `aside` sits on the right on wide screens (for example a search box or key facts).
 */
export function PageHero({
  eyebrow,
  title,
  text,
  aside,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  text?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="container-content pt-4 md:pt-6">
      <div className="relative isolate overflow-hidden rounded-[2rem] bg-brand px-6 py-14 text-white sm:px-10 md:px-14 md:py-20">
        <Rings className="-top-40 -right-32 -z-10 size-[34rem] text-brand-light/15" />
        <Rings className="-bottom-56 -left-40 -z-10 size-[28rem] text-brand-light/10" />
        <div className={cn("grid gap-10", aside && "lg:grid-cols-[1.4fr_1fr] lg:items-end")}>
          <div className="flex max-w-3xl flex-col gap-5" data-reveal>
            {eyebrow && <Eyebrow tone="dark">{eyebrow}</Eyebrow>}
            <h1 className="text-h1 text-white md:text-[3.75rem] md:leading-[1.04]">{title}</h1>
            {text && <div className="max-w-2xl text-body-lg text-brand-light">{text}</div>}
            {children}
          </div>
          {aside && <div data-reveal>{aside}</div>}
        </div>
      </div>
    </section>
  );
}

/** Section heading used across the public pages. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  text,
  align = "left",
  tone = "light",
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  text?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
}) {
  return (
    <div
      data-reveal
      className={cn("flex max-w-2xl flex-col gap-4", align === "center" && "mx-auto items-center text-center")}
    >
      {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
      <h2 id={id} className={cn("text-h2", tone === "dark" ? "text-white" : "text-ink")}>
        {title}
      </h2>
      {text && <p className={cn("text-body-lg", tone === "dark" ? "text-brand-light" : "text-stone")}>{text}</p>}
    </div>
  );
}
