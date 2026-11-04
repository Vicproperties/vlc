import type { ReactNode } from "react";

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-sans text-[1.625rem] leading-tight font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {description && <p className="text-small text-stone">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
