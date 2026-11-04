"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "error" | "info";

interface ToastMessage {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  notify: (toast: Omit<ToastMessage, "id">) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneStyles: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CircleCheck, className: "text-success" },
  error: { icon: CircleAlert, className: "text-danger" },
  info: { icon: Info, className: "text-brand" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (toast: Omit<ToastMessage, "id">) => {
      const id = nextId.current++;
      setToasts((all) => [...all.slice(-2), { ...toast, id }]);
      window.setTimeout(() => dismiss(id), toast.tone === "error" ? 8000 : 5000);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-3 sm:right-6 sm:bottom-6 sm:left-auto"
      >
        {toasts.map((toast) => {
          const { icon: Icon, className } = toneStyles[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 border border-line bg-surface px-4 py-3.5 shadow-overlay"
            >
              <Icon className={cn("mt-0.5 size-[1.125rem] shrink-0", className)} strokeWidth={1.5} aria-hidden="true" />
              <div className="flex flex-1 flex-col gap-0.5">
                <p className="text-small font-medium text-ink">{toast.title}</p>
                {toast.description && <p className="text-caption text-stone">{toast.description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="-mr-1 flex size-7 items-center justify-center text-stone hover:text-ink"
              >
                <X className="size-4" strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>.");
  return ctx;
}
