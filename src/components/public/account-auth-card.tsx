import type { ReactNode } from "react";
import { CalendarCheck, Heart, MessageSquare } from "lucide-react";
import { Rings } from "@/components/public/page-hero";
import { siteConfig } from "@/config/site";
import { Skeleton } from "@/components/ui/states";

/** Frame for the customer sign-in, registration and password pages. */
export function AccountAuthCard({
  title,
  intro,
  children,
  footer,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="container-content py-10 md:py-16">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-line/70 bg-white shadow-overlay lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative isolate hidden flex-col justify-between gap-10 overflow-hidden bg-brand p-10 text-white lg:flex">
          <Rings className="-right-40 -bottom-40 -z-10 size-[30rem] text-brand-light/15" />
          <div className="flex flex-col gap-3">
            <p className="text-caption font-semibold tracking-[0.16em] text-brand-light uppercase">Your account</p>
            <p className="text-h3 font-bold">{siteConfig.name}</p>
          </div>
          <ul className="flex flex-col gap-5 text-small text-white/90">
            {[
              { icon: Heart, text: "Save properties to your favourites" },
              { icon: CalendarCheck, text: "Follow your inspection requests" },
              { icon: MessageSquare, text: "Like and comment on articles" },
            ].map((item) => (
              <li key={item.text} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-brand-light"
                >
                  <item.icon className="size-5" strokeWidth={1.75} />
                </span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-8 p-6 sm:p-10 md:p-12">
          <div className="flex flex-col gap-3">
            <h1 className="text-h2 text-ink">{title}</h1>
            {intro && <p className="text-small text-stone">{intro}</p>}
          </div>
          {children}
          {footer && <div className="border-t border-line pt-6 text-small text-stone">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function AuthFormFallback() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
    </div>
  );
}
