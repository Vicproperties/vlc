import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

/** Loading placeholder. Decorative only; pair with an accessible loading message where needed. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse bg-line/60", className)} />;
}

interface StateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: StateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4 border border-line px-6 py-16 text-center", className)}>
      {Icon && <Icon className="size-6 text-stone" strokeWidth={1.25} aria-hidden="true" />}
      <div className="flex max-w-md flex-col gap-2">
        <h3 className="font-serif text-h3">{title}</h3>
        {description && <p className="text-small text-stone">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ icon: Icon, title, description, action, className }: StateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-start gap-3 border-l-2 border-danger bg-danger-tint px-5 py-4", className)}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-[1.125rem] text-danger" strokeWidth={1.5} aria-hidden="true" />}
        <p className="text-small font-medium text-danger">{title}</p>
      </div>
      {description && <p className="text-small text-ink">{description}</p>}
      {action}
    </div>
  );
}

/** Status text used in tables and detail views — coloured text with a small square marker, never a pill. */
export type StatusTone = "neutral" | "accent" | "success" | "warning" | "danger";

const toneText: Record<StatusTone, string> = {
  neutral: "text-stone",
  accent: "text-forest",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export function StatusText({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-small font-medium", toneText[tone])}>
      <span aria-hidden="true" className="size-1.5 bg-current" />
      {children}
    </span>
  );
}
