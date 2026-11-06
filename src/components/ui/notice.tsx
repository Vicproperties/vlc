import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type NoticeTone = "info" | "success" | "error";

const tones: Record<NoticeTone, string> = {
  info: "border-brand bg-brand-tint text-ink",
  success: "border-success bg-success-tint text-ink",
  error: "border-danger bg-danger-tint text-ink",
};

/**
 * Inline message for forms and pages. Errors are announced immediately (role="alert"),
 * other messages politely (role="status").
 */
export function Notice({
  tone = "info",
  children,
  className,
}: {
  tone?: NoticeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-xl border-l-4 px-4 py-3 text-small", tones[tone], className)}
    >
      {children}
    </div>
  );
}
