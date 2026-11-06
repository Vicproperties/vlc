"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Modal built on the native <dialog> element: the browser provides focus trapping,
 * Escape to close, inert background and top-layer stacking. Focus returns to the
 * previously focused element on close.
 */
export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  variant?: "center" | "drawer-right" | "drawer-left" | "drawer-bottom";
  className?: string;
  /** Close when the backdrop is clicked. Default true. */
  dismissible?: boolean;
}

const variantClasses: Record<NonNullable<DialogProps["variant"]>, string> = {
  center: "m-auto w-[calc(100%-2rem)] max-w-lg max-h-[calc(100dvh-2rem)]",
  "drawer-right": "ml-auto mr-0 my-0 h-dvh max-h-dvh w-[min(26rem,100%)]",
  "drawer-left": "mr-auto ml-0 my-0 h-dvh max-h-dvh w-[min(22rem,100%)]",
  "drawer-bottom": "mt-auto mb-0 mx-0 w-full max-w-none max-h-[85dvh]",
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = "center",
  className,
  dismissible = true,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose();
      }}
      className={cn(
        "flex-col bg-white p-0 text-ink shadow-overlay backdrop:bg-ink/40 open:flex",
        variant === "center" && "rounded-2xl",
        variantClasses[variant],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-6 border-b border-line px-6 py-5">
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="font-serif text-h3">
            {title}
          </h2>
          {description && (
            <p id={descriptionId} className="text-small text-stone">
              {description}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 flex size-10 shrink-0 items-center justify-center text-stone transition-colors hover:text-ink"
        >
          <X className="size-5" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      {footer && <div className="flex flex-wrap justify-end gap-3 border-t border-line px-6 py-4">{footer}</div>}
    </dialog>
  );
}
