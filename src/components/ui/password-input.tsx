"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { Input, type InputProps } from "./input";

/**
 * Password field with a show/hide toggle.
 * Hidden by default; the toggle is a real button (keyboard and touch accessible),
 * exposes its state through aria-pressed, and swaps between eye and eye-off icons.
 */
export function PasswordInput({ className, ...props }: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-stone transition-colors hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
      >
        {visible ? (
          <EyeOff className="size-[1.125rem]" strokeWidth={1.5} aria-hidden="true" />
        ) : (
          <Eye className="size-[1.125rem]" strokeWidth={1.5} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
