import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "link" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-sans font-medium whitespace-nowrap select-none " +
  "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-deep rounded-sm",
  secondary: "border border-ink text-ink bg-transparent hover:bg-ink hover:text-paper rounded-sm",
  quiet: "text-ink bg-transparent hover:bg-brand-tint rounded-sm",
  link: "text-brand underline decoration-1 underline-offset-4 hover:text-brand-deep hover:decoration-2 px-0! h-auto!",
  danger: "bg-danger text-white hover:bg-danger-deep rounded-sm",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-small",
  md: "h-11 px-6 text-small tracking-[0.02em]",
  lg: "h-13 px-8 text-body tracking-[0.02em]",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export type ButtonProps = ComponentProps<"button"> & ButtonOwnProps;

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : leadingIcon}
      <span>{children}</span>
      {!loading && trailingIcon}
    </button>
  );
}

export type ButtonLinkProps = ComponentProps<typeof Link> & Omit<ButtonOwnProps, "loading">;

export function ButtonLink({
  variant = "primary",
  size = "md",
  leadingIcon,
  trailingIcon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, className)} {...props}>
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </Link>
  );
}
