import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Accessible form field wrapper: label, optional hint, and error message.
 * Pass the same `id` to the control and use `fieldDescribedBy(id, { hint, error })`
 * for its aria-describedby.
 */
export interface FormFieldProps {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  optionalLabel?: boolean;
  className?: string;
  children: ReactNode;
}

export function fieldDescribedBy(id: string, opts: { hint?: unknown; error?: unknown }): string | undefined {
  const ids = [opts.hint ? `${id}-hint` : null, opts.error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export function FormField({ id, label, hint, error, required, optionalLabel, className, children }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label id={`${id}-label`} htmlFor={id} className="text-small font-medium text-ink">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
        )}
        {optionalLabel && !required && <span className="font-normal text-stone"> (optional)</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-caption text-stone">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-caption text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
