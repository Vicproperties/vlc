"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { EstateFormState } from "@/features/estates/actions";

type Action = (state: EstateFormState, formData: FormData) => Promise<EstateFormState>;

export function EstateForm({
  action,
  initial,
  submitLabel,
}: {
  action: Action;
  initial: Record<string, string>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as EstateFormState);
  const values = state.values ?? initial;
  const errors = state.fieldErrors ?? {};
  const a11y = (name: string, hint?: unknown) => ({
    id: name,
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": fieldDescribedBy(name, { hint, error: errors[name] }),
  });

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6" noValidate>
      {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
      <FormField id="name" label="Estate name" error={errors.name} required>
        <Input {...a11y("name")} defaultValue={values.name} maxLength={150} required />
      </FormField>
      <FormField id="location" label="Location" error={errors.location}>
        <Input {...a11y("location")} defaultValue={values.location} maxLength={300} />
      </FormField>
      <FormField
        id="description"
        label="Internal notes"
        hint="Only visible in the dashboard."
        error={errors.description}
      >
        <Textarea {...a11y("description", true)} rows={4} defaultValue={values.description} maxLength={5000} />
      </FormField>
      <Button type="submit" loading={pending} className="self-start">
        {submitLabel}
      </Button>
    </form>
  );
}
