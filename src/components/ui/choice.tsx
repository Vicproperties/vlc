import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const boxBase =
  "size-[1.125rem] shrink-0 border border-line-strong bg-surface accent-forest cursor-pointer " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest " +
  "disabled:cursor-not-allowed disabled:opacity-50";

interface ChoiceProps extends Omit<ComponentProps<"input">, "type"> {
  label: ReactNode;
  description?: ReactNode;
}

function Choice({ type, label, description, className, id, ...props }: ChoiceProps & { type: "checkbox" | "radio" }) {
  return (
    <label htmlFor={id} className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input id={id} type={type} className={cn(boxBase, "mt-0.5", type === "radio" && "rounded-full")} {...props} />
      <span className="flex flex-col gap-0.5">
        <span className="text-small text-ink">{label}</span>
        {description && <span className="text-caption text-stone">{description}</span>}
      </span>
    </label>
  );
}

export function Checkbox(props: ChoiceProps) {
  return <Choice type="checkbox" {...props} />;
}

export function Radio(props: ChoiceProps) {
  return <Choice type="radio" {...props} />;
}
