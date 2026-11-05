"use client";

import { startTransition, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { FormField, fieldDescribedBy } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import type { ContentFormState } from "@/features/content/actions";
import type { SectionDef } from "@/features/content/sections";
import { prepareImageForUpload } from "@/features/properties/resize-image";
import { RichTextEditor } from "./rich-text-editor";

type Action = (state: ContentFormState, formData: FormData) => Promise<ContentFormState>;

/**
 * Editor for one page section, generated from its definition. Image fields are resized in
 * the browser before upload (fast on mobile data); the server processes them again.
 */
export function SectionEditor({
  def,
  content,
  imageUrls = {},
  isVisible,
  action,
  canEdit,
}: {
  def: SectionDef;
  content: Record<string, string>;
  /** Public URLs of the current images, keyed by field. */
  imageUrls?: Record<string, string>;
  isVisible: boolean;
  action: Action;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" } as ContentFormState);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<Record<string, string>>({});
  const errors: Record<string, string | undefined> = { ...state.fieldErrors, ...localError };
  const id = (field: string) => `${def.page}-${def.key}-${field}`;
  const hasImage = def.fields.some((field) => field.type === "image");

  return (
    <section className="grid gap-6 border-t border-line pt-8 lg:grid-cols-[14rem_1fr] lg:gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-body font-semibold text-ink">{def.title}</h2>
        <p className="text-small text-stone">{def.description}</p>
      </div>
      <form
        className="flex min-w-0 flex-col gap-5"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          setLocalError({});
          if (hasImage) {
            setPreparing(true);
            for (const field of def.fields.filter((f) => f.type === "image")) {
              const file = formData.get(field.key);
              if (file instanceof File && file.size > 0) {
                try {
                  const blob = await prepareImageForUpload(file, 2400);
                  formData.set(field.key, new File([blob], "image", { type: blob.type }));
                } catch (error) {
                  setLocalError({
                    [field.key]: error instanceof Error ? error.message : "The image could not be prepared.",
                  });
                  setPreparing(false);
                  return;
                }
              } else {
                formData.delete(field.key);
              }
            }
            setPreparing(false);
          }
          startTransition(() => formAction(formData));
        }}
      >
        {state.message && <Notice tone={state.status === "success" ? "success" : "error"}>{state.message}</Notice>}
        {def.fields.map((field) => {
          const fieldId = id(field.key);
          const error = errors[field.key];
          const common = {
            id: fieldId,
            name: field.key,
            defaultValue: content[field.key] ?? "",
            disabled: !canEdit,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": fieldDescribedBy(fieldId, { hint: field.hint, error }),
          };
          if (field.type === "image") {
            const current = imageUrls[field.key];
            return (
              <FormField key={field.key} id={fieldId} label={field.label} hint={field.hint} error={error} optionalLabel>
                <div className="flex flex-col gap-3">
                  {current && (
                    // eslint-disable-next-line @next/next/no-img-element -- dashboard preview of an optimised WebP
                    <img
                      src={current}
                      alt="Current background image"
                      className="aspect-[16/7] w-full max-w-xl object-cover"
                    />
                  )}
                  <input
                    id={fieldId}
                    name={field.key}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    disabled={!canEdit}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={fieldDescribedBy(fieldId, { hint: field.hint, error })}
                    className="text-small text-ink file:mr-4 file:h-10 file:cursor-pointer file:rounded-sm file:border file:border-ink file:bg-transparent file:px-4 file:text-small file:text-ink"
                  />
                  {current && (
                    <Checkbox
                      id={`${fieldId}-remove`}
                      name={`${field.key}_remove`}
                      value="on"
                      disabled={!canEdit}
                      label="Remove the current image"
                    />
                  )}
                </div>
              </FormField>
            );
          }
          return (
            <FormField key={field.key} id={fieldId} label={field.label} hint={field.hint} error={error}>
              {field.type === "text" ? (
                <Input {...common} maxLength={field.max} />
              ) : field.type === "textarea" ? (
                <Textarea {...common} rows={3} maxLength={field.max} />
              ) : (
                <RichTextEditor
                  id={fieldId}
                  name={field.key}
                  labelledBy={`${fieldId}-label`}
                  defaultValue={content[field.key] ?? ""}
                  invalid={!!error}
                />
              )}
            </FormField>
          );
        })}
        <Checkbox
          id={id("visible")}
          name="is_visible"
          value="on"
          defaultChecked={isVisible}
          disabled={!canEdit}
          label="Show this section on the website"
        />
        {canEdit && (
          <Button type="submit" variant="secondary" loading={pending || preparing} className="self-start">
            Save {def.title.toLowerCase()}
          </Button>
        )}
      </form>
    </section>
  );
}
