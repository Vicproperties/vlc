import type { ReactNode } from "react";

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <h1 className="font-serif text-h2 text-ink">{title}</h1>
      {description && <p className="text-small text-stone">{description}</p>}
    </div>
  );
}
