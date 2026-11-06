"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { type BrandingState, removeBrandingAction, uploadBrandingAction } from "@/features/settings/branding";

function BrandingField({
  kind,
  label,
  hint,
  currentUrl,
  preview,
}: {
  kind: "logo" | "favicon";
  label: string;
  hint: string;
  currentUrl: string | null;
  preview: "wide" | "square";
}) {
  const [state, action, pending] = useActionState<BrandingState, FormData>(uploadBrandingAction.bind(null, kind), {
    status: "idle",
  });
  const [removed, setRemoved] = useState<BrandingState | null>(null);
  const [removing, start] = useTransition();
  const shown = removed ?? (state.status !== "idle" ? state : null);
  const inputId = `branding-${kind}`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line p-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-sans text-body font-semibold text-ink">{label}</h3>
        <p className="text-small text-stone">{hint}</p>
      </div>
      <div className="flex items-center gap-4">
        <div
          className={
            preview === "wide"
              ? "flex h-20 w-56 items-center justify-center rounded-xl border border-line bg-surface p-3"
              : "flex size-20 items-center justify-center rounded-xl border border-line bg-surface p-3"
          }
        >
          {currentUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview of our own stored image
            <img
              src={currentUrl}
              alt={`Current ${label.toLowerCase()}`}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-caption text-stone">None yet</span>
          )}
        </div>
      </div>
      {shown?.message && <Notice tone={shown.status === "success" ? "success" : "error"}>{shown.message}</Notice>}
      <form action={action} className="flex flex-wrap items-center gap-3" onSubmit={() => setRemoved(null)}>
        <label htmlFor={inputId} className="sr-only">
          {label} file
        </label>
        <input
          id={inputId}
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          className="text-small text-ink file:mr-3 file:rounded-full file:border-0 file:bg-brand-tint file:px-4 file:py-2 file:text-small file:font-medium file:text-brand"
        />
        <Button type="submit" loading={pending}>
          Upload
        </Button>
        {currentUrl && (
          <Button
            variant="quiet"
            loading={removing}
            onClick={() => start(async () => setRemoved(await removeBrandingAction(kind)))}
          >
            Remove
          </Button>
        )}
      </form>
    </div>
  );
}

export function BrandingForm({ logoUrl, faviconUrl }: { logoUrl: string | null; faviconUrl: string | null }) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="branding-heading">
      <h2 id="branding-heading" className="font-sans text-h4 font-semibold text-ink">
        Logo and browser icon
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <BrandingField
          kind="logo"
          label="Logo"
          hint="Shown in the website header and footer. PNG with a transparent background works best. Without a logo, the company name is shown."
          currentUrl={logoUrl}
          preview="wide"
        />
        <BrandingField
          kind="favicon"
          label="Browser icon (favicon)"
          hint="The small icon in browser tabs and phone home screens. Use a square PNG, at least 512 × 512 pixels."
          currentUrl={faviconUrl}
          preview="square"
        />
      </div>
    </section>
  );
}
