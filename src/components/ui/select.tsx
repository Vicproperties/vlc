import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { controlBase } from "./input";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentProps<"select">, "children"> {
  options: ReadonlyArray<SelectOption>;
  placeholder?: string;
}

/** Native select for reliable mobile behaviour and accessibility. */
export function Select({ options, placeholder, className, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select className={cn(controlBase, "h-11 appearance-none pr-10 pl-3.5 text-body", className)} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-stone"
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </div>
  );
}
