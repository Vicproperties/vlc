import type { ReactNode } from "react";
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
    <div className="container-content flex justify-center py-16 md:py-24">
      <div className="flex w-full max-w-md flex-col gap-8 rounded-3xl border border-line/70 bg-white p-6 shadow-card sm:p-10">
        <div className="flex flex-col gap-3">
          <h1 className="font-serif text-h2 text-ink">{title}</h1>
          {intro && <p className="text-small text-stone">{intro}</p>}
        </div>
        {children}
        {footer && <div className="border-t border-line pt-6 text-small text-stone">{footer}</div>}
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
