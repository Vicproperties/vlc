import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export const controlBase =
  "w-full bg-surface text-ink placeholder:text-stone/70 border border-line-strong rounded-sm " +
  "transition-colors duration-150 hover:border-stone " +
  "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand focus:border-brand " +
  "disabled:cursor-not-allowed disabled:bg-paper disabled:text-stone " +
  "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger";

export type InputProps = ComponentProps<"input">;

export function Input({ className, type = "text", ...props }: InputProps) {
  return <input type={type} className={cn(controlBase, "h-11 px-3.5 text-body", className)} {...props} />;
}

export type TextareaProps = ComponentProps<"textarea">;

export function Textarea({ className, rows = 5, ...props }: TextareaProps) {
  return <textarea rows={rows} className={cn(controlBase, "resize-y px-3.5 py-3 text-body", className)} {...props} />;
}
